import { resolvePublicUrl } from './runtime-config';

const API_URL = resolvePublicUrl(process.env.NEXT_PUBLIC_API_URL);

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getOriginHint = (): string => {
  if (typeof window === 'undefined') {
    return 'unknown-origin';
  }

  return window.location.origin;
};

const withNetworkErrorHandling = async <T>(request: () => Promise<T>, fallback: string): Promise<T> => {
  try {
    return await request();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `${fallback} Backend is unreachable or blocked by CORS. API URL: ${API_URL}. Frontend origin: ${getOriginHint()}. Check NEXT_PUBLIC_API_URL and backend CLIENT_ORIGIN.`
      );
    }
    throw error;
  }
};

const createRoomRequest = async (): Promise<CreateRoomResponse> => {
  const response = await fetch(`${API_URL}/api/rooms/create`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to create room.'));
  }

  return response.json();
};

export const createRoom = async (): Promise<CreateRoomResponse> => {
  return withNetworkErrorHandling(async () => {
    try {
      return await createRoomRequest();
    } catch (error) {
      if (error instanceof TypeError) {
        await sleep(1200);
        return createRoomRequest();
      }

      throw error;
    }
  }, 'Failed to create room.');
};

export const getRoom = async (roomId: string): Promise<RoomResponse> => {
  return withNetworkErrorHandling(async () => {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Room unavailable.'));
    }

    return response.json();
  }, 'Failed to load room.');
};
