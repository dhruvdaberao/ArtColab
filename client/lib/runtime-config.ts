const LOCAL_BACKEND_URL = 'http://localhost:4000';
const PRODUCTION_BACKEND_FALLBACK_URL = 'https://artcolab-1.onrender.com';

const isLocalHost = (hostname: string): boolean => {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const getDefaultBackendUrl = (): string => {
  if (typeof window !== 'undefined') {
    return isLocalHost(window.location.hostname) ? LOCAL_BACKEND_URL : PRODUCTION_BACKEND_FALLBACK_URL;
  }

  return process.env.NODE_ENV === 'production' ? PRODUCTION_BACKEND_FALLBACK_URL : LOCAL_BACKEND_URL;
};

const normalizeUrl = (value: string): string => value.replace(/\/+$/, '');

export const resolvePublicUrl = (envValue: string | undefined): string => {
  const value = envValue?.trim();
  return normalizeUrl(value && value.length > 0 ? value : getDefaultBackendUrl());
};
