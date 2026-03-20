import type { SessionUser } from "./api";

export const GUEST_DISPLAY_NAME_STORAGE_KEY = "cloudcanvas-display-name";

export const getStoredDisplayName = () =>
  typeof window === "undefined"
    ? ""
    : (localStorage.getItem(GUEST_DISPLAY_NAME_STORAGE_KEY)?.trim() ?? "");

const createGuestDisplayName = () =>
  `Guest ${Math.floor(1000 + Math.random() * 9000)}`;

export const ensureGuestDisplayName = () => {
  const existing = getStoredDisplayName();
  if (existing) return existing;
  return setStoredDisplayName(createGuestDisplayName());
};

export const setStoredDisplayName = (name: string) => {
  if (typeof window === "undefined") return "";
  const normalized = name.trim();
  if (normalized) {
    localStorage.setItem(GUEST_DISPLAY_NAME_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(GUEST_DISPLAY_NAME_STORAGE_KEY);
  }
  return normalized;
};

export const resolveSessionDisplayName = (
  user: SessionUser | null | undefined,
) => {
  if (user?.role === "user") return user.username;
  const stored = getStoredDisplayName();
  if (stored) return stored;
  if (user?.username?.trim()) return user.username.trim();
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
