import { io } from 'socket.io-client';

import { resolvePublicUrl } from './runtime-config';

const resolveSocketUrl = () => {
  const explicit = resolvePublicUrl(process.env.NEXT_PUBLIC_SOCKET_URL);
  if (explicit) return explicit;

  if (typeof window === 'undefined') return resolvePublicUrl(undefined);

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:4000`;
};

export const socket = io(resolveSocketUrl(), {
  autoConnect: false,
  withCredentials: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 4000,
  timeout: 10000,
});
