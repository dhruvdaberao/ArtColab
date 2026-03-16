const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface CreateRoomResponse {
  room: { roomId: string };
}

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
};

export const createRoom = async (): Promise<CreateRoomResponse> => {
  const response = await fetch(`${API_URL}/api/rooms/create`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to create room'));
  }

  return response.json();
};

export const getRoom = async (roomId: string) => {
  const response = await fetch(`${API_URL}/api/rooms/${roomId}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Room unavailable'));
  }

  return response.json();
};
