import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z.string().optional(),
  ROOM_IDLE_TIMEOUT_MS: z.coerce.number().default(15 * 60 * 1000),
  CLEANUP_INTERVAL_MS: z.coerce.number().default(60 * 1000),
  MAX_STROKES_PER_ROOM: z.coerce.number().default(1000),
  REDIS_URL: z.string().optional()
});

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardToRegExp = (pattern: string): RegExp => {
  const normalized = normalizeOrigin(pattern);
  const escaped = escapeRegExp(normalized).replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
};

export const env = envSchema.parse(process.env);

const defaultClientOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://art-colab-client.vercel.app'];

const configuredClientOrigins = (env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const effectiveClientOrigins = [...defaultClientOrigins, ...configuredClientOrigins];

const uniqueClientOrigins = [...new Set(effectiveClientOrigins)];

const wildcardOriginPatterns = uniqueClientOrigins
  .filter((origin) => origin.includes('*'))
  .map((origin) => ({
    origin,
    matcher: wildcardToRegExp(origin)
  }));

const exactOrigins = new Set(uniqueClientOrigins.filter((origin) => !origin.includes('*')));

export const allowedClientOrigins = uniqueClientOrigins;

export const isAllowedClientOrigin = (origin?: string): boolean => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  if (exactOrigins.has(normalizedOrigin)) {
    return true;
  }

  return wildcardOriginPatterns.some(({ matcher }) => matcher.test(normalizedOrigin));
};
