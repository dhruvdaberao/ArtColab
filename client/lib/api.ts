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

export interface CreateRoomResponse {
  room: { roomId: string };
}

export interface RoomResponse {
  room: {
    roomId: string;
    createdAt: number;
    updatedAt: number;
    expiresAt: number | null;
  };
}

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
};

const withNetworkErrorHandling = async <T>(request: () => Promise<T>, fallback: string): Promise<T> => {
  try {
    return await request();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`${fallback} Backend is unreachable. Please check server URL and deployment status.`);
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

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, fallback));
    }

    return response.json();
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

export const createRoom = async (): Promise<CreateRoomResponse> => request('/api/rooms/create', { method: 'POST' }, 'Failed to create room.');

export const getRoom = async (roomId: string): Promise<RoomResponse> => request(`/api/rooms/${roomId}`, { cache: 'no-store' }, 'Failed to load room.');

export const guestLogin = async (): Promise<{ token: string; user: SessionUser }> => request('/api/auth/guest', { method: 'POST' }, 'Failed to continue as guest.');

export const registerUser = async (payload: { email: string; username: string; password: string; confirmPassword: string }) =>
  request<{ token: string; user: SessionUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }, 'Failed to create account.');

export const loginUser = async (payload: { identifier: string; password: string }) =>
  request<{ token: string; user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }, 'Login failed.');

export const getMe = async () => request<{ user: SessionUser | null }>('/api/auth/me', { method: 'GET' }, 'Failed to load session.');

export const requestResetCode = async (email: string) =>
  request<{ message: string }>('/api/auth/forgot-password/request', { method: 'POST', body: JSON.stringify({ email }) }, 'Failed to request reset code.');

export const verifyResetCode = async (payload: { email: string; code: string; password: string; confirmPassword: string }) =>
  request<{ message: string }>('/api/auth/forgot-password/verify', { method: 'POST', body: JSON.stringify(payload) }, 'Failed to reset password.');

export const updateProfile = async (payload: { username?: string; email?: string; profileImageDataUri?: string }) =>
  request<{ user: SessionUser; message: string }>('/api/profile', { method: 'PATCH', body: JSON.stringify(payload) }, 'Failed to update profile.');

export const logoutUser = async () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }, 'Logout failed.');
