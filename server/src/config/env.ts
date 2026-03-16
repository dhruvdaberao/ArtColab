import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000'),
  ROOM_IDLE_TIMEOUT_MS: z.coerce.number().default(15 * 60 * 1000),
  CLEANUP_INTERVAL_MS: z.coerce.number().default(60 * 1000),
  MAX_STROKES_PER_ROOM: z.coerce.number().default(1000),
  REDIS_URL: z.string().optional()
});

export const env = envSchema.parse(process.env);
