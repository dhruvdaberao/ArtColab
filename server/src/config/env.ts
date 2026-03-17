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
  REDIS_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  MONGO_URI: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wildcardToRegExp = (pattern: string): RegExp => {
  const normalized = normalizeOrigin(pattern);
  const escaped = escapeRegExp(normalized).replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
};

const parsedEnv = envSchema.parse(process.env);
const mongoUri = parsedEnv.MONGODB_URI ?? parsedEnv.MONGO_URI;
const jwtSecret = parsedEnv.JWT_SECRET?.trim() ? parsedEnv.JWT_SECRET : 'development-cloudcanvas-jwt-secret';

export const env = {
  ...parsedEnv,
  MONGODB_URI: mongoUri,
  JWT_SECRET: jwtSecret
};

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

export const validateCriticalEnv = () => {
  const warnings: string[] = [];

  if (!env.MONGODB_URI) {
    warnings.push('MONGODB_URI/MONGO_URI is missing. Database-backed features will be unavailable.');
  }

  if (!env.JWT_SECRET || env.JWT_SECRET === 'development-cloudcanvas-jwt-secret') {
    warnings.push('JWT_SECRET is missing or using default development value. Use a strong secret in production.');
  }

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    warnings.push('Resend email env vars are incomplete. Password reset email delivery will be disabled.');
  }

  warnings.forEach((warning) => console.warn(`[env] ${warning}`));
};
