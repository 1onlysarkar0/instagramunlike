import { db } from "./db";
import {
  jobs,
  settings,
  type Job,
  type CreateJobRequest,
  JOB_STATUS
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createJob(data: { status: string }): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  updateJob(id: number, updates: Partial<Job>): Promise<Job>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value }
      });
  }

  async createJob(data: { status: string }): Promise<Job> {
    const [job] = await db.insert(jobs).values(data).returning();
    return job;
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async updateJob(id: number, updates: Partial<Job>): Promise<Job> {
    const [updated] = await db.update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
