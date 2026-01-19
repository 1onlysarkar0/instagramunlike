import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, stopped
  targetType: text("target_type").notNull().default("like"), // like, comment
  totalToProcess: integer("total_to_process").default(0),
  totalUnliked: integer("total_unliked").default(0),
  totalSkipped: integer("total_skipped").default(0),
  totalErrors: integer("total_errors").default(0),
  speed: integer("speed").default(5), // Concurrency level
  logs: jsonb("logs").$type<string[]>().default([]), // Simple array of recent logs
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ 
  id: true, 
  createdAt: true, 
  status: true, 
  totalToProcess: true,
  totalUnliked: true, 
  totalSkipped: true, 
  totalErrors: true, 
  logs: true 
});

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type Job = typeof jobs.$inferSelect;

// Request types
export type CreateJobRequest = {
  cookies: string; // JSON string of cookies
  speed?: number;
  targetType: "like" | "comment";
};

// Response types
export type JobResponse = Job;
export type JobsListResponse = Job[];

export const JOB_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  STOPPED: "stopped",
} as const;
