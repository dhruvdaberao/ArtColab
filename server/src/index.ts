import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import { allowedClientOrigins, defaultClientOrigins, env } from './config/env.js';
import { RoomManager } from './rooms/roomManager.js';
import { roomsRouter } from './routes/rooms.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';

const app = express();
const server = http.createServer(app);
const roomManager = new RoomManager();

const matchesAllowedOrigin = (origin: string, allowedOrigin: string) => {
  if (allowedOrigin.startsWith('*.')) {
    const suffix = allowedOrigin.slice(1);
    return origin.endsWith(suffix);
  }

  return origin === allowedOrigin;
};

const isOriginAllowed = (origin?: string) => {
  if (!origin) return true;
  return allowedClientOrigins.some((allowedOrigin) => matchesAllowedOrigin(origin, allowedOrigin));
};

const corsOrigin: cors.CorsOptions['origin'] = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS blocked for origin: ${origin}`));
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  },
  maxHttpBufferSize: 1e6
});

app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    nodeEnv: env.NODE_ENV
  });
});

app.use('/api/rooms', roomsRouter(roomManager));

registerSocketHandlers(io, roomManager);

const cleanupTimer = setInterval(() => {
  const removed = roomManager.cleanupExpiredRooms();
  removed.forEach((roomId) => {
    io.to(roomId).emit(SOCKET_EVENTS.ROOM_EXPIRED, { roomId });
  });
}, env.CLEANUP_INTERVAL_MS);

cleanupTimer.unref();

if (env.NODE_ENV === 'production' && env.CLIENT_ORIGIN === defaultClientOrigins.join(',')) {
  console.warn(
    '[CloudCanvas] warning: using default CLIENT_ORIGIN in production. Set CLIENT_ORIGIN to your exact Vercel domain.'
  );
}

server.listen(env.PORT, '0.0.0.0', () => {
  console.log('[CloudCanvas] backend started');
  console.log(`[CloudCanvas] port=${env.PORT}`);
  console.log(`[CloudCanvas] node_env=${env.NODE_ENV}`);
  console.log(`[CloudCanvas] allowed_client_origins=${allowedClientOrigins.join(',') || 'none'}`);
});
