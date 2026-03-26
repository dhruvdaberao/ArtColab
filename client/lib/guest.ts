import type { SessionUser } from "./api";

export const GUEST_DISPLAY_NAME_STORAGE_KEY = "froodle-guest-display-name";
const LEGACY_GUEST_DISPLAY_NAME_STORAGE_KEY = "cloudcanvas-display-name";
const MAX_GUEST_NAME_LENGTH = 32;

const normalizeGuestDisplayName = (name: string | null | undefined) =>
  (name ?? "").trim().slice(0, MAX_GUEST_NAME_LENGTH);

export const getStoredDisplayName = () =>
  typeof window === "undefined"
    ? ""
    : normalizeGuestDisplayName(
        localStorage.getItem(GUEST_DISPLAY_NAME_STORAGE_KEY) ??
          localStorage.getItem(LEGACY_GUEST_DISPLAY_NAME_STORAGE_KEY),
      );

export const createGuestDisplayName = () => {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Guest_${suffix}`;
};

export const setStoredDisplayName = (name: string) => {
  if (typeof window === "undefined") return "";
  const normalized = normalizeGuestDisplayName(name);
  if (normalized) {
    localStorage.setItem(GUEST_DISPLAY_NAME_STORAGE_KEY, normalized);
    localStorage.removeItem(LEGACY_GUEST_DISPLAY_NAME_STORAGE_KEY);
  } else {
    localStorage.removeItem(GUEST_DISPLAY_NAME_STORAGE_KEY);
    localStorage.removeItem(LEGACY_GUEST_DISPLAY_NAME_STORAGE_KEY);
  }
  return normalized;
};

export const ensureGuestDisplayName = (preferredName?: string | null) => {
  const preferred = normalizeGuestDisplayName(preferredName);
  if (preferred) return setStoredDisplayName(preferred);

  const existing = getStoredDisplayName();
  if (existing) return existing;

  return setStoredDisplayName(createGuestDisplayName());
};

export const resolveSessionDisplayName = (
  user: SessionUser | null | undefined,
) => {
  if (user?.role === "user") return user.username;
  const stored = getStoredDisplayName();
  if (stored) return stored;
  if (user?.username?.trim()) return ensureGuestDisplayName(user.username);
  return ensureGuestDisplayName();
};

export const getAvatarInitials = (name: string | null | undefined) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "G";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
};
