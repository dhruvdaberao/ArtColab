import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000,https://art-colab-client.vercel.app'),
  ROOM_IDLE_TIMEOUT_MS: z.coerce.number().default(15 * 60 * 1000),
  CLEANUP_INTERVAL_MS: z.coerce.number().default(60 * 1000),
  MAX_STROKES_PER_ROOM: z.coerce.number().default(1000),
  REDIS_URL: z.string().optional()
});

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

export const env = envSchema.parse(process.env);

export const defaultClientOrigins = ['http://localhost:3000', 'https://art-colab-client.vercel.app'];

const configuredClientOrigins = env.CLIENT_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean);

export const allowedClientOrigins = [...new Set([...configuredClientOrigins, ...defaultClientOrigins])];
