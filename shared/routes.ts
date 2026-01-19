import { z } from 'zod';
import { jobs } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  jobs: {
    create: {
      method: 'POST' as const,
      path: '/api/jobs',
      input: z.object({
        cookies: z.string().min(1, "Cookies are required"),
        speed: z.number().min(1).max(200).optional(),
        targetType: z.enum(["like", "comment"]).default("like"),
      }),
      responses: {
        201: z.custom<typeof jobs.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/jobs/:id',
      responses: {
        200: z.custom<typeof jobs.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    stop: {
      method: 'POST' as const,
      path: '/api/jobs/:id/stop',
      responses: {
        200: z.custom<typeof jobs.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  settings: {
    getCookies: {
      method: 'GET' as const,
      path: '/api/settings/cookies',
      responses: {
        200: z.object({ cookies: z.string() }),
      },
    },
    clearCookies: {
      method: 'POST' as const,
      path: '/api/settings/cookies/clear',
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
