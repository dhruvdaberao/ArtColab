import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CLIENT_ORIGIN: z.string().optional(),
  CLIENT_URL: z.string().optional(),
  CLIENT_ORIGINS: z.string().optional(),
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

const parseOriginList = (...values: Array<string | undefined>): string[] => values
  .flatMap((value) => (value ?? '').split(/[\s,]+/))
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const parsedEnv = envSchema.parse(process.env);
const mongoUri = parsedEnv.MONGODB_URI ?? parsedEnv.MONGO_URI;
const jwtSecret = parsedEnv.JWT_SECRET?.trim() ? parsedEnv.JWT_SECRET : 'development-cloudcanvas-jwt-secret';

export const env = {
  ...parsedEnv,
  MONGODB_URI: mongoUri,
  JWT_SECRET: jwtSecret
};

const defaultClientOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://art-colab-client.vercel.app',
  'https://froodle.vercel.app'
];

const configuredClientOrigins = parseOriginList(env.CLIENT_ORIGIN, env.CLIENT_URL, env.CLIENT_ORIGINS);
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

export const allowedClientOriginEnvSummary = {
  CLIENT_ORIGIN: env.CLIENT_ORIGIN?.trim() || null,
  CLIENT_URL: env.CLIENT_URL?.trim() || null,
  CLIENT_ORIGINS: env.CLIENT_ORIGINS?.trim() || null
};

export const getClientOriginDecision = (origin?: string) => {
  if (!origin) {
    return {
      allowed: true,
      normalizedOrigin: null,
      reason: 'no-origin-header'
    } as const;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (exactOrigins.has(normalizedOrigin)) {
    return {
      allowed: true,
      normalizedOrigin,
      reason: 'exact-match'
    } as const;
  }

  const wildcardMatch = wildcardOriginPatterns.find(({ matcher }) => matcher.test(normalizedOrigin));
  if (wildcardMatch) {
    return {
      allowed: true,
      normalizedOrigin,
      reason: `wildcard-match:${wildcardMatch.origin}`
    } as const;
  }

  return {
    allowed: false,
    normalizedOrigin,
    reason: 'not-configured'
  } as const;
};

export const isAllowedClientOrigin = (origin?: string): boolean => getClientOriginDecision(origin).allowed;

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

  if (!env.CLIENT_ORIGIN && !env.CLIENT_URL && !env.CLIENT_ORIGINS) {
    warnings.push('CLIENT_ORIGIN/CLIENT_URL/CLIENT_ORIGINS is not set; using built-in safe defaults.');
  }

  warnings.forEach((warning) => console.warn(`[env] ${warning}`));
};
