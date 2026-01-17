import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { JOB_STATUS } from "@shared/schema";
import { IgApiClient } from "instagram-private-api";

// Simple in-memory job tracker for the worker loop
// In a production app, use Redis/BullMQ. Here, we keep it simple for the MVP.
const activeJobs = new Map<number, boolean>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.jobs.create.path, async (req, res) => {
    try {
      const input = api.jobs.create.input.parse(req.body);
      
      // Save cookies for persistence
      await storage.setSetting("instagram_cookies", input.cookies);

      // Basic validation of cookies JSON
      try {
        const cookies = JSON.parse(input.cookies);
        if (!Array.isArray(cookies)) {
          throw new Error("Cookies must be a JSON array");
        }
      } catch (e) {
        return res.status(400).json({ message: "Invalid JSON format for cookies" });
      }

      const job = await storage.createJob({ 
        status: JOB_STATUS.PENDING,
        speed: input.speed || 5
      });
      
      // Start processing in background
      processJob(job.id, input.cookies, input.speed || 5).catch(console.error);

      res.status(201).json(job);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.jobs.get.path, async (req, res) => {
    const job = await storage.getJob(Number(req.params.id));
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  });

  app.post(api.jobs.stop.path, async (req, res) => {
    const id = Number(req.params.id);
    const job = await storage.getJob(id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Signal job to stop
    activeJobs.set(id, false);
    
    const updated = await storage.updateJob(id, { status: JOB_STATUS.STOPPED });
    res.json(updated);
  });

  app.get(api.settings.getCookies.path, async (req, res) => {
    const cookies = await storage.getSetting("instagram_cookies");
    res.json({ cookies: cookies || "" });
  });

  app.post(api.settings.clearCookies.path, async (req, res) => {
    await storage.setSetting("instagram_cookies", "");
    res.json({ success: true });
  });

  return httpServer;
}

async function processJob(jobId: number, cookieJson: string, speed: number) {
  activeJobs.set(jobId, true);
  
  const log = async (msg: string) => {
    const job = await storage.getJob(jobId);
    if (!job) return;
    const newLogs = [...(job.logs || []), `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50); // Keep last 50 logs
    await storage.updateJob(jobId, { logs: newLogs });
  };

  try {
    await storage.updateJob(jobId, { status: JOB_STATUS.RUNNING });
    await log(`Starting automation with speed ${speed}...`);

    const ig = new IgApiClient();
    
    // Parse cookies and extract sessionid and other relevant cookies
    // This is a best-effort cookie reconstruction for instagram-private-api
    // which normally expects a full state or username/password.
    // We will try to mock the state or use a lower-level approach if possible.
    // NOTE: instagram-private-api is strict about state.
    // A better approach with just cookies is to manually reconstruct the cookie jar.
    
    let cookies: any[];
    try {
      cookies = JSON.parse(cookieJson);
    } catch (e) {
      throw new Error("Invalid cookie JSON");
    }

    // Extract username if possible (not strictly required for session but good for logging)
    const username = "user"; 
    
    ig.state.generateDevice(username);

    // Map the JSON cookies to the client's cookie jar
    // We assume cookies are in a format like [{ name: "sessionid", value: "..." }, ...]
    await Promise.all(
      cookies.map((c) => {
        if (c.domain === "instagram.com" || c.domain === ".instagram.com") {
             // Reconstruct cookie string manually for simplicity or use efficient method
             // But the library manages state internally.
             // We need to inject these into the request client.
             // The library uses `tough-cookie` internally.
             const cookieStr = `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path || '/'}`;
             return ig.state.cookieJar.setCookie(cookieStr, "https://www.instagram.com");
        }
        return Promise.resolve();
      })
    );
    
    await log("Cookies loaded. Verifying session...");

    // Verify session by fetching current user
    let currentUser;
    try {
        currentUser = await ig.account.currentUser();
        await log(`Logged in as ${currentUser.username}`);
    } catch (e) {
        await log("Session verification failed. Cookies might be invalid or expired.");
        throw e;
      }

    await log("Fetching liked media...");
    
    // Fetch total count of liked media to show progress
    try {
      const userInfo = await ig.user.info(ig.state.cookieUserId!);
      const totalLikes = userInfo.total_igtv_videos || 0; // Close enough for display if total likes not direct
      // Actually, better to just log the count we get from the feed if it's available
      // For now we'll set it to a placeholder or update it dynamically
    } catch (e) {}

    const likedFeed = ig.feed.liked();
    let unlikedCount = 0;
    let errorsCount = 0;
    let totalEstimated = 0;

    // Automation loop
    while (activeJobs.get(jobId)) {
      try {
        // Increase batch size from default (usually 20) by fetching more or just relying on speed
        // The library fetches in pages. We'll process what we get.
        const items = await likedFeed.items();
        if (items.length === 0) {
          await log("No more liked posts found.");
          break;
        }
        
        // Update total to process if it's the first batch and more are available
        if (totalEstimated === 0) {
          totalEstimated = items.length + (likedFeed.isMoreAvailable() ? 200 : 0);
          await storage.updateJob(jobId, { totalToProcess: totalEstimated });
        }

        await log(`Processing batch of ${items.length} posts concurrently (Speed: ${speed})...`);

        // Concurrent unliking within the batch
        // We use speed as concurrency. User requested 200x.
        const CONCURRENCY = speed; 
        for (let i = 0; i < items.length; i += CONCURRENCY) {
          if (!activeJobs.get(jobId)) break;

          const batch = items.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(async (item) => {
            try {
              const shortcode = item.code || item.id.split('_')[0];
              const author = item.user?.username || "unknown";
              const postUrl = `https://www.instagram.com/p/${shortcode}/`;

              // Direct request for speed
              await ig.request.send({
                url: `/api/v1/media/${item.pk}/unlike/`,
                method: 'POST',
                form: {
                  media_id: item.pk,
                  module_name: 'feed_contextual_post',
                  radio_type: 'wifi-none',
                  _uuid: ig.state.uuid,
                  _uid: ig.state.cookieUserId,
                  _csrftoken: ig.state.cookieCsrfToken,
                },
              });

              unlikedCount++;
              // Throttled logging for high speeds to prevent log overflow
              if (speed < 50 || unlikedCount % 10 === 0) {
                await log(`[SUCCESS] Unliked post by @${author}: ${postUrl}`);
              }
            } catch (error: any) {
              errorsCount++;
              if (speed < 50 || errorsCount % 10 === 0) {
                await log(`[ERROR] Failed to unlike post: ${error.message}`);
              }
            }
          }));

          // Minimal delay between batches - reduced for high speed
          const delay = speed > 50 ? 200 : 1000;
          await new Promise(r => setTimeout(r, delay));
          await storage.updateJob(jobId, { totalUnliked: unlikedCount, totalErrors: errorsCount });
        }

        if (!likedFeed.isMoreAvailable()) {
          await log("Reached end of liked feed.");
          break;
        }

        // Reduced delay between feed pages for high speed
        const pageDelay = speed > 50 ? 500 : 2000;
        await new Promise(r => setTimeout(r, pageDelay));

      } catch (feedError: any) {
        await log(`Feed error: ${feedError.message}`);
        errorsCount++;
        await storage.updateJob(jobId, { totalErrors: errorsCount });
        // Break on feed error (likely rate limit or session invalid)
        break;
      }
    }

    if (activeJobs.get(jobId)) {
        await storage.updateJob(jobId, { status: JOB_STATUS.COMPLETED });
        await log("Job completed.");
    } else {
        await storage.updateJob(jobId, { status: JOB_STATUS.STOPPED });
    }

  } catch (error: any) {
    console.error("Job failed:", error);
    await storage.updateJob(jobId, { 
      status: JOB_STATUS.FAILED,
    });
    await log(`Critical error: ${error.message}`);
  } finally {
    activeJobs.delete(jobId);
  }
}
