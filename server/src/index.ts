import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import { env } from './config/env.js';
import { RoomManager } from './rooms/roomManager.js';
import { roomsRouter } from './routes/rooms.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    credentials: true
  },
  maxHttpBufferSize: 1e6
});

const roomManager = new RoomManager();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
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

server.listen(env.PORT, () => {
  console.log(`CloudCanvas server running on :${env.PORT}`);
});
