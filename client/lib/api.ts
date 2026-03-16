const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface CreateRoomResponse {
  room: { roomId: string };
}

export const createRoom = async (): Promise<CreateRoomResponse> => {
  const response = await fetch(`${API_URL}/api/rooms/create`, {
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error('Failed to create room');
  }
  return response.json();
};

export const getRoom = async (roomId: string) => {
  const response = await fetch(`${API_URL}/api/rooms/${roomId}`, {
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error('Room unavailable');
  }
  return response.json();
};
