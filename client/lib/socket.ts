import { io } from 'socket.io-client';

import { resolvePublicUrl } from './runtime-config';

const SOCKET_URL = resolvePublicUrl(process.env.NEXT_PUBLIC_SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 10000
});
