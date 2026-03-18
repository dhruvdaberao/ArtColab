const STORAGE_KEY = "froddle-room-access";

const readGrantedRoomIds = (): string[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
};

const writeGrantedRoomIds = (roomIds: string[]) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(roomIds));
};

export const hasRoomAccessGrant = (roomId: string): boolean =>
  readGrantedRoomIds().includes(roomId.trim().toUpperCase());

export const grantRoomAccess = (roomId: string) => {
  const normalizedRoomId = roomId.trim().toUpperCase();
  const roomIds = readGrantedRoomIds();
  if (roomIds.includes(normalizedRoomId)) return;
  writeGrantedRoomIds([...roomIds, normalizedRoomId]);
};

export const revokeRoomAccess = (roomId: string) => {
  const normalizedRoomId = roomId.trim().toUpperCase();
  writeGrantedRoomIds(
    readGrantedRoomIds().filter((candidate) => candidate !== normalizedRoomId),
  );
};
