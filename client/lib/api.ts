import { resolvePublicUrl } from './runtime-config';

const API_URL = resolvePublicUrl(process.env.NEXT_PUBLIC_API_URL);

export type SessionUser = {
  id?: string;
  username: string;
  email?: string;
  profileImage?: string;
  role: 'guest' | 'user';
  createdRooms?: string[];
  joinedRooms?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type RoomListItem = {
  roomId: string;
  name: string;
  visibility: 'public' | 'private';
  owner: { type: 'user' | 'guest'; name: string } | null;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  participants: number;
};

export interface CreateRoomResponse {
  room: { roomId: string; name?: string; visibility?: 'public' | 'private' };
}

export interface RoomResponse {
  room: {
    roomId: string;
    name?: string;
    visibility?: 'public' | 'private';
    createdAt: number;
    updatedAt: number;
    lastActiveAt?: number;
    expiresAt: number | null;
  };
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const withNetworkErrorHandling = async <T>(requestFn: () => Promise<T>, fallback: string): Promise<T> => {
  try {
    return await requestFn();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new ApiError(`${fallback} Backend is unreachable. Please check deployment status and API URL.`);
    }

    throw error;
  }
};

const authToken = () => (typeof window !== 'undefined' ? localStorage.getItem('cloudcanvas-auth-token') : null);
const request = async <T>(path: string, options: RequestInit = {}, fallback = 'Request failed.'): Promise<T> => {
  return withNetworkErrorHandling(async () => {
    const token = authToken();
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const message = (body as { message?: string } | null)?.message || fallback;
      throw new ApiError(message, response.status);
    }

    return body as T;
  }, fallback);
};

export const setAuthToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (!token) {
    localStorage.removeItem('cloudcanvas-auth-token');
    return;
  }
  localStorage.setItem('cloudcanvas-auth-token', token);
};

export const createRoom = async (payload: { name: string; visibility: 'public' | 'private'; password?: string; guestDisplayName?: string }): Promise<CreateRoomResponse> =>
  request('/api/rooms/create', { method: 'POST', body: JSON.stringify(payload) }, 'Failed to create room.');

export const joinRoom = async (payload: { name: string; visibility: 'public' | 'private'; password?: string; guestDisplayName?: string }): Promise<{ roomId: string }> =>
  request('/api/rooms/join', { method: 'POST', body: JSON.stringify(payload) }, 'Failed to join room.');

export const browseRooms = async (query: string): Promise<{ rooms: RoomListItem[] }> =>
  request(`/api/rooms/browse?q=${encodeURIComponent(query)}`, { cache: 'no-store' }, 'Failed to browse rooms.');

export const getManageRooms = async (): Promise<{ ownedRooms: RoomListItem[]; joinedRooms: RoomListItem[]; message?: string }> =>
  request('/api/rooms/manage', { cache: 'no-store' }, 'Failed to load manage rooms.');

export const updateRoomSettings = async (roomId: string, payload: { name?: string; visibility?: 'public' | 'private'; password?: string }) =>
  request<{ room: RoomListItem }>(`/api/rooms/${roomId}/settings`, { method: 'PATCH', body: JSON.stringify(payload) }, 'Failed to update room settings.');

export const deleteRoom = async (roomId: string) => request<{ success: boolean }>(`/api/rooms/${roomId}`, { method: 'DELETE' }, 'Failed to delete room.');

export const leaveRoom = async (roomId: string) => request<{ success: boolean }>(`/api/rooms/${roomId}/leave`, { method: 'POST' }, 'Failed to leave room.');

export const getRoom = async (roomId: string): Promise<RoomResponse> => request(`/api/rooms/${roomId}`, { cache: 'no-store' }, 'Failed to load room.');

export const guestLogin = async (): Promise<{ token: string; user: SessionUser }> => request('/api/auth/guest', { method: 'POST' }, 'Failed to continue as guest.');

export const registerUser = async (payload: { email: string; username: string; password: string; confirmPassword: string; guestToken?: string | null; guestDisplayName?: string }) =>
  request<{ token: string; user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }, 'Failed to create account.');

export const loginUser = async (payload: { identifier: string; password: string; guestToken?: string | null; guestDisplayName?: string }) =>
  request<{ token: string; user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }, 'Login failed.');

export const getMe = async () => request<{ user: SessionUser | null }>('/api/auth/me', { method: 'GET' }, 'Failed to load session.');

export const requestResetCode = async (email: string) =>
  request<{ message: string }>('/api/auth/forgot-password/request', { method: 'POST', body: JSON.stringify({ email }) }, 'Failed to request reset code.');

export const verifyResetCode = async (payload: { email: string; code: string; password: string; confirmPassword: string }) =>
  request<{ message: string }>('/api/auth/forgot-password/verify', { method: 'POST', body: JSON.stringify(payload) }, 'Failed to reset password.');

export const updateProfile = async (payload: { username?: string; email?: string; profileImageDataUri?: string }) =>
  request<{ user: SessionUser; message: string }>('/api/profile', { method: 'PATCH', body: JSON.stringify(payload) }, 'Failed to update profile.');

export const logoutUser = async () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }, 'Logout failed.');
