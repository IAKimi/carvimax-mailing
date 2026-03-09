import { z } from 'zod';
import { 
  insertCampaignSchema, 
  insertContactSchema, 
  campaigns, 
  campaignVersions,
  contacts
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats' as const,
      responses: {
        200: z.object({
          totalSent: z.number(),
          byCountry: z.record(z.string(), z.number()),
          recentCampaigns: z.array(z.custom<typeof campaigns.$inferSelect>())
        }),
      }
    }
  },
  campaigns: {
    list: {
      method: 'GET' as const,
      path: '/api/campaigns' as const,
      responses: {
        200: z.array(z.custom<typeof campaigns.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/campaigns/:id' as const,
      responses: {
        200: z.custom<typeof campaigns.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/campaigns' as const,
      input: insertCampaignSchema,
      responses: {
        201: z.custom<typeof campaigns.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/campaigns/:id' as const,
      input: insertCampaignSchema.partial(),
      responses: {
        200: z.custom<typeof campaigns.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    }
  },
  campaignVersions: {
    list: {
      method: 'GET' as const,
      path: '/api/campaigns/:id/versions' as const,
      responses: {
        200: z.array(z.custom<typeof campaignVersions.$inferSelect>()),
        404: errorSchemas.notFound,
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/campaigns/:id/generate' as const,
      responses: {
        201: z.custom<typeof campaignVersions.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/versions/:id' as const,
      input: z.object({
        contentJson: z.any().optional(),
        isSelected: z.boolean().optional(),
      }),
      responses: {
        200: z.custom<typeof campaignVersions.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    }
  },
  contacts: {
    list: {
      method: 'GET' as const,
      path: '/api/contacts' as const,
      responses: {
        200: z.array(z.custom<typeof contacts.$inferSelect>()),
      }
    }
  }
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
