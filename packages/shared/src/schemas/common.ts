import { z } from 'zod';
import { LOG_LEVELS } from '../types/log.js';

export const logFilterSchema = z.object({
  level: z.enum(LOG_LEVELS).optional(),
  minLevel: z.enum(LOG_LEVELS).optional(),
  category: z.string().max(100).optional(),
  since: z.string().max(50).optional(),
  until: z.string().max(50).optional(),
  search: z.string().max(500).optional(),
  errorCode: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export const idParamSchema = z.object({
  id: z.string().min(1).max(255),
});

export type LogFilterSchema = z.infer<typeof logFilterSchema>;
