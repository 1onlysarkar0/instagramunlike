import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { JOB_STATUS } from "@shared/schema";
import { IgApiClient } from "instagram-private-api";

const activeJobs = new Map<number, boolean>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.jobs.create.path, async (req, res) => {
    try {
      const input = api.jobs.create.input.parse(req.body);
      
      await storage.setSetting("instagram_cookies", input.cookies);

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
        speed: input.speed || 5,
        targetType: input.targetType
      });
      
      processJob(job.id, input.cookies, input.speed || 5, input.targetType).catch(console.error);

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

async function processJob(jobId: number, cookieJson: string, speed: number, targetType: string = "like") {
  activeJobs.set(jobId, true);
  
  const log = async (msg: string) => {
    const job = await storage.getJob(jobId);
    if (!job) return;
    const newLogs = [...(job.logs || []), `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50);
    await storage.updateJob(jobId, { logs: newLogs });
  };

  try {
    await storage.updateJob(jobId, { status: JOB_STATUS.RUNNING });
    await log(`Starting automation for ${targetType}s with speed ${speed}...`);

    const ig = new IgApiClient();
    
    let cookies: any[];
    try {
      cookies = JSON.parse(cookieJson);
    } catch (e) {
      throw new Error("Invalid cookie JSON");
    }

    const username = "user"; 
    ig.state.generateDevice(username);

    await Promise.all(
      cookies.map((c) => {
        if (c.domain === "instagram.com" || c.domain === ".instagram.com") {
             const cookieStr = `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path || '/'}`;
             return ig.state.cookieJar.setCookie(cookieStr, "https://www.instagram.com");
        }
        return Promise.resolve();
      })
    );
    
    await log("Cookies loaded. Verifying session...");

    let currentUser;
    try {
        currentUser = await ig.account.currentUser();
        await log(`Logged in as ${currentUser.username}`);
    } catch (e) {
        await log("Session verification failed. Cookies might be invalid or expired.");
        throw e;
      }

    await log(`Fetching ${targetType} data source...`);
    
    let feed: any;
    if (targetType === "like") {
      feed = ig.feed.liked();
    } else {
      await log("Scanning timeline and liked posts for your comments...");
      // For comments, we combine multiple sources to find media you've interacted with
      // The timeline and liked feed are the most likely places to find your comments.
      feed = ig.feed.timeline(); 
    }

    let processedCount = 0;
    let errorsCount = 0;
    let totalEstimated = 0;

    while (activeJobs.get(jobId)) {
      try {
        const items = await feed.items();
        if (items.length === 0) {
          if (targetType === "comment" && feed === ig.feed.timeline()) {
            await log("Timeline scan complete. checking liked posts for comments...");
            feed = ig.feed.liked();
            continue;
          }
          await log(`No more media found to scan for ${targetType}s.`);
          break;
        }
        
        if (totalEstimated === 0) {
          totalEstimated = items.length + (feed.isMoreAvailable() ? 200 : 0);
          await storage.updateJob(jobId, { totalToProcess: totalEstimated });
        }

        await log(`Scanning batch of ${items.length} posts for ${targetType}s...`);

        const CONCURRENCY = speed; 
        for (let i = 0; i < items.length; i += CONCURRENCY) {
          if (!activeJobs.get(jobId)) break;

          const batch = items.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(async (item: any) => {
            try {
              const author = item.user?.username || "unknown";
              
              if (targetType === "like") {
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
                
                processedCount++;
                if (speed < 50 || processedCount % 10 === 0) {
                  await log(`[SUCCESS] Unliked post by @${author}`);
                }
              } else {
                // Fetch comments for this post to find yours
                const comments = await ig.feed.mediaComments(item.pk).items();
                const userComments = comments.filter((c: any) => c.user_id.toString() === ig.state.cookieUserId?.toString());
                
                if (userComments.length > 0) {
                  for (const uc of userComments) {
                    // Delete each comment
                    await ig.request.send({
                      url: `/api/v1/media/${item.pk}/comment/bulk_delete/`,
                      method: 'POST',
                      form: {
                        comment_ids_to_delete: uc.pk,
                        _uuid: ig.state.uuid,
                        _uid: ig.state.cookieUserId,
                        _csrftoken: ig.state.cookieCsrfToken,
                      },
                    });
                    processedCount++;
                    await log(`[SUCCESS] Deleted comment on @${author}'s post`);
                  }
                }
              }
            } catch (error: any) {
              errorsCount++;
              // Don't log every error if it's just a "comment not found" or similar
              if (speed < 10) {
                await log(`[ERROR] Processing @${author}: ${error.message}`);
              }
            }
          }));

          const delay = speed > 150 ? 50 : speed > 50 ? 200 : 1000;
          await new Promise(r => setTimeout(r, delay));
          await storage.updateJob(jobId, { totalUnliked: processedCount, totalErrors: errorsCount });
        }

        if (!feed.isMoreAvailable()) {
          if (targetType === "comment" && feed === ig.feed.timeline()) {
            await log("Timeline scan complete. switching to liked posts...");
            feed = ig.feed.liked();
            continue;
          }
          break;
        }

        const pageDelay = speed > 150 ? 100 : speed > 50 ? 500 : 2000;
        await new Promise(r => setTimeout(r, pageDelay));

      } catch (feedError: any) {
        await log(`Feed scan error: ${feedError.message}`);
        break;
      }
    }

    if (activeJobs.get(jobId)) {
      await storage.updateJob(jobId, { status: JOB_STATUS.COMPLETED });
      await log("Automation sequence finished.");
    } else {
      await storage.updateJob(jobId, { status: JOB_STATUS.STOPPED });
    }

  } catch (error: any) {
    console.error("Job failed:", error);
    await storage.updateJob(jobId, { 
      status: JOB_STATUS.FAILED,
    });
    await log(`Fatal error: ${error.message}`);
  } finally {
    activeJobs.delete(jobId);
  }
}
