import { z } from "zod";
import { resolvePublicUrl } from "./runtime-config";
import { getStoredDisplayName } from "./guest";

const API_URL = resolvePublicUrl(process.env.NEXT_PUBLIC_API_URL);

export type SessionUser = {
  id?: string;
  username: string;
  email?: string;
  profileImage?: string;
  role: "guest" | "user";
  createdRooms?: string[];
  joinedRooms?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type RoomListItem = {
  roomId: string;
  name: string;
  visibility: "public" | "private";
  owner: { type: "user" | "guest"; name: string } | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  participants: number;
};

export interface CreateRoomResponse {
  room: RoomListItem;
}

export interface RoomResponse {
  room: {
    roomId: string;
    name: string;
    visibility: "public" | "private";
    createdAt: number;
    updatedAt: number;
    lastActiveAt: number;
    expiresAt: number | null;
  };
}

const roomListItemSchema = z.object({
  roomId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/),
  name: z.string().trim().min(1),
  visibility: z.enum(["public", "private"]),
  owner: z
    .object({ type: z.enum(["user", "guest"]), name: z.string().trim().min(1) })
    .nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastActiveAt: z.number(),
  participants: z.number().int().nonnegative(),
});

const createRoomResponseSchema = z.object({ room: roomListItemSchema });
const joinRoomResponseSchema = z.object({ room: roomListItemSchema });
const roomResponseSchema = z.object({
  room: z.object({
    roomId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6}$/),
    name: z.string().trim().min(1),
    visibility: z.enum(["public", "private"]),
    createdAt: z.number(),
    updatedAt: z.number(),
    lastActiveAt: z.number(),
    expiresAt: z.number().nullable(),
  }),
});

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const withNetworkErrorHandling = async <T>(
  requestFn: () => Promise<T>,
  fallback: string,
): Promise<T> => {
  try {
    return await requestFn();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new ApiError(
        `${fallback} Backend is unreachable. Please check deployment status and API URL.`,
      );
    }

    throw error;
  }
};

const authToken = () =>
  typeof window !== "undefined"
    ? localStorage.getItem("cloudcanvas-auth-token")
    : null;

const REQUEST_TIMEOUT_MS = 15000;

const combineSignals = (
  signalA?: AbortSignal | null,
  signalB?: AbortSignal | null,
): AbortSignal | undefined => {
  if (!signalA) return signalB ?? undefined;
  if (!signalB) return signalA ?? undefined;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signalA.addEventListener("abort", abort, { once: true });
  signalB.addEventListener("abort", abort, { once: true });
  if (signalA.aborted || signalB.aborted) controller.abort();
  return controller.signal;
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
  fallback = "Request failed.",
): Promise<T> => {
  return withNetworkErrorHandling(async () => {
    const token = authToken();
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const guestDisplayName =
      typeof window !== "undefined" ? getStoredDisplayName() : "";
    if (!token && guestDisplayName && !headers.has("X-Guest-Display-Name")) {
      headers.set("X-Guest-Display-Name", guestDisplayName);
    }
    const timeoutController = new AbortController();
    const timeoutId = globalThis.setTimeout(
      () => timeoutController.abort(),
      REQUEST_TIMEOUT_MS,
    );
    const signal = combineSignals(options.signal, timeoutController.signal);
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        signal,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        timeoutController.signal.aborted
      ) {
        throw new ApiError(
          `${fallback} The server took too long to respond.`,
          504,
          "REQUEST_TIMEOUT",
        );
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      const payload = body as { message?: string; error?: string; code?: string } | null;
      const message = payload?.message || fallback;
      throw new ApiError(message, response.status, payload?.code || payload?.error);
    }

    return body as T;
  }, fallback);
};

const parseResponse = <T>(
  value: unknown,
  schema: z.ZodType<T>,
  fallbackMessage: string,
): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    console.error("[api] malformed response payload", {
      fallbackMessage,
      issues: parsed.error.issues,
      value,
    });
    throw new ApiError(fallbackMessage, 502, "INVALID_RESPONSE_PAYLOAD");
  }
  return parsed.data;
};

export const setAuthToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem("cloudcanvas-auth-token");
    return;
  }
  localStorage.setItem("cloudcanvas-auth-token", token);
};

export const createRoom = async (payload: {
  name: string;
  visibility: "public" | "private";
  password?: string;
  guestDisplayName?: string;
}): Promise<CreateRoomResponse> =>
  parseResponse(
    await request(
      "/api/rooms/create",
      { method: "POST", body: JSON.stringify(payload) },
      "Failed to create room.",
    ),
    createRoomResponseSchema,
    "Create room returned invalid room data.",
  );

export const joinRoom = async (payload: {
  name: string;
  visibility: "public" | "private";
  password?: string;
  guestDisplayName?: string;
}): Promise<{ room: RoomListItem }> =>
  parseResponse(
    await request(
      "/api/rooms/join",
      { method: "POST", body: JSON.stringify(payload) },
      "Failed to join room.",
    ),
    joinRoomResponseSchema,
    "Join room returned invalid room data.",
  );

export const browseRooms = async (
  query: string,
): Promise<{ rooms: RoomListItem[] }> =>
  request(
    `/api/rooms/browse?q=${encodeURIComponent(query)}`,
    { cache: "no-store" },
    "Failed to browse rooms.",
  );

export const getManageRooms = async (): Promise<{
  ownedRooms: RoomListItem[];
  joinedRooms: RoomListItem[];
  message?: string;
}> =>
  request(
    "/api/rooms/manage",
    { cache: "no-store" },
    "Failed to load manage rooms.",
  );

export const updateRoomSettings = async (
  roomId: string,
  payload: {
    name?: string;
    visibility?: "public" | "private";
    password?: string;
  },
) =>
  request<{ room: RoomListItem }>(
    `/api/rooms/${roomId}/settings`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "Failed to update room settings.",
  );

export const deleteRoom = async (roomId: string) =>
  request<{ success: boolean }>(
    `/api/rooms/${roomId}`,
    { method: "DELETE" },
    "Failed to delete room.",
  );

export const leaveRoom = async (roomId: string) =>
  request<{ success: boolean }>(
    `/api/rooms/${roomId}/leave`,
    { method: "POST" },
    "Failed to leave room.",
  );

export const getRoom = async (roomId: string): Promise<RoomResponse> =>
  parseResponse(
    await request(
      `/api/rooms/${roomId}`,
      { cache: "no-store" },
      "Failed to load room.",
    ),
    roomResponseSchema,
    "Room page received malformed room data.",
  );

export const guestLogin = async (): Promise<{
  token: string;
  user: SessionUser;
}> =>
  request(
    "/api/auth/guest",
    { method: "POST" },
    "Failed to continue as guest.",
  );

export const registerUser = async (payload: {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  guestToken?: string | null;
  guestDisplayName?: string;
}) =>
  request<{ token: string; user: SessionUser }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify(payload) },
    "Failed to create account.",
  );

export const loginUser = async (payload: {
  identifier: string;
  password: string;
  guestToken?: string | null;
  guestDisplayName?: string;
}) =>
  request<{ token: string; user: SessionUser }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify(payload) },
    "Login failed.",
  );

export const getMe = async () =>
  request<{ user: SessionUser | null }>(
    "/api/auth/me",
    { method: "GET" },
    "Failed to load session.",
  );

export const requestResetCode = async (email: string) =>
  request<{ message: string }>(
    "/api/auth/forgot-password/request",
    { method: "POST", body: JSON.stringify({ email }) },
    "Failed to send OTP. Try again",
  );

export const verifyResetOtp = async (payload: {
  email: string;
  otp: string;
}) =>
  request<{ message: string; resetToken: string }>(
    "/api/auth/forgot-password/verify-otp",
    { method: "POST", body: JSON.stringify(payload) },
    "Failed to verify OTP. Please try again.",
  );

export const resetPasswordWithOtp = async (payload: {
  email: string;
  resetToken: string;
  password: string;
  confirmPassword: string;
}) =>
  request<{ message: string }>(
    "/api/auth/forgot-password/reset-password",
    { method: "POST", body: JSON.stringify(payload) },
    "Failed to reset password.",
  );

export const updateProfile = async (payload: {
  username?: string;
  email?: string;
  profileImageDataUri?: string;
}) =>
  request<{ user: SessionUser; message: string }>(
    "/api/profile",
    { method: "PATCH", body: JSON.stringify(payload) },
    "Failed to update profile.",
  );

export const logoutUser = async () =>
  request<{ success: boolean }>(
    "/api/auth/logout",
    { method: "POST" },
    "Logout failed.",
  );


export const deleteAccount = async (payload: {
  confirmationText: 'DELETE';
  password: string;
}) =>
  request<{ success: boolean; deletedRoomIds: string[]; message: string }>(
    '/api/profile/account',
    { method: 'DELETE', body: JSON.stringify(payload) },
    'Failed to delete account.',
  );
