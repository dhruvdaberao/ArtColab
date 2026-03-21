export const ROOM_PAGE_ACTIVE_CLASS = "room-page-active";
export const ROOM_PAGE_LANDSCAPE_CLASS = "room-page-landscape";
export const ROOM_VIEWPORT_HEIGHT_VAR = "--room-viewport-height";
export const ROOM_VIEWPORT_WIDTH_VAR = "--room-viewport-width";

let activeRoomOrientationToken = 0;

const isBrowser = () =>
  typeof window !== "undefined" && typeof document !== "undefined";

const getOrientationController = () => {
  if (typeof screen === "undefined" || !("orientation" in screen)) return null;
  return screen.orientation as ScreenOrientation & {
    lock?: (orientation: "portrait" | "landscape") => Promise<void>;
    unlock?: () => void;
  };
};

const clearRoomDomState = () => {
  if (!isBrowser()) return;

  document.documentElement.classList.remove(ROOM_PAGE_ACTIVE_CLASS);
  document.body.classList.remove(ROOM_PAGE_ACTIVE_CLASS);
  document.documentElement.classList.remove(ROOM_PAGE_LANDSCAPE_CLASS);
  document.body.classList.remove(ROOM_PAGE_LANDSCAPE_CLASS);
  document.documentElement.removeAttribute("data-room-rotated");
  document.body.removeAttribute("data-room-rotated");
  document.documentElement.style.removeProperty("overscroll-behavior");
  document.documentElement.style.removeProperty(ROOM_VIEWPORT_HEIGHT_VAR);
  document.documentElement.style.removeProperty(ROOM_VIEWPORT_WIDTH_VAR);
  delete document.documentElement.dataset.roomOrientationOwner;
  delete document.body.dataset.roomOrientationOwner;
};

const maybeExitRoomFullscreen = async (roomId?: string) => {
  if (!isBrowser()) return;

  const fullscreenElement = document.fullscreenElement as HTMLElement | null;
  if (!fullscreenElement) return;

  const fullscreenOwner = fullscreenElement.dataset.roomFullscreenOwner;
  const roomDomWasActive =
    document.documentElement.classList.contains(ROOM_PAGE_ACTIVE_CLASS) ||
    document.body.classList.contains(ROOM_PAGE_ACTIVE_CLASS);

  if (
    fullscreenOwner &&
    roomId &&
    fullscreenOwner !== roomId &&
    !roomDomWasActive
  ) {
    return;
  }

  try {
    await document.exitFullscreen();
  } catch (error) {
    console.info("[room-orientation] fullscreen exit skipped", { roomId, error });
  } finally {
    delete fullscreenElement.dataset.roomFullscreenOwner;
  }
};

const maybeUnlockOrientation = () => {
  const orientation = getOrientationController();
  if (!orientation) return;

  try {
    orientation.unlock?.();
  } catch (error) {
    console.info("[room-orientation] orientation unlock skipped", { error });
  }
};

export const beginRoomOrientationSession = () => {
  activeRoomOrientationToken += 1;
  return activeRoomOrientationToken;
};

export const isRoomOrientationSessionActive = (token: number) =>
  token === activeRoomOrientationToken;

export const cancelRoomOrientationSession = (token?: number) => {
  if (typeof token === "number") {
    if (token === activeRoomOrientationToken) activeRoomOrientationToken += 1;
    return;
  }

  activeRoomOrientationToken += 1;
};

export const exitRoomOrientation = async (roomId?: string) => {
  cancelRoomOrientationSession();
  clearRoomDomState();
  maybeUnlockOrientation();
  await maybeExitRoomFullscreen(roomId);
};

export const enforcePortraitMode = async () => {
  cancelRoomOrientationSession();
  clearRoomDomState();
  maybeUnlockOrientation();
  await maybeExitRoomFullscreen();

  const orientation = getOrientationController();
  if (!orientation?.lock) return;

  try {
    await orientation.lock("portrait");
  } catch (error) {
    console.info("[room-orientation] portrait lock skipped", { error });
  }
};
