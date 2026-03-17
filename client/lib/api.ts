const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

export const createRoom = async (): Promise<CreateRoomResponse> => {
  return withNetworkErrorHandling(async () => {
    const response = await fetch(`${API_URL}/api/rooms/create`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Failed to create room.'));
    }

    return response.json();
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
