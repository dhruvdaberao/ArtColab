import http from 'node:http';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import { allowedClientOrigins, env, isAllowedClientOrigin } from './config/env.js';
import { connectMongo, isMongoReady } from './db/mongo.js';
import { Room } from './models/Room.js';
import { RoomManager } from './rooms/roomManager.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { roomsRouter } from './routes/rooms.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';

type PersistedRoomRecord = {
  passwordHash?: string | null;
} & Record<string, unknown>;

const app = express();
const server = http.createServer(app);
const roomManager = new RoomManager(async (roomId, state) => {
  if (!isMongoReady()) return;
  await Room.findOneAndUpdate(
    { roomId },
    {
      $set: {
        'canvasState.strokes': state.strokes,
        'canvasState.lastSavedAt': state.lastSavedAt,
        updatedAt: state.updatedAt,
        lastActiveAt: state.lastActiveAt
      },
      $inc: { 'canvasState.version': 1 }
    }
  );
});

const corsOrigin: cors.CorsOptions['origin'] = (origin, callback) => {
  if (isAllowedClientOrigin(origin)) {
    callback(null, true);
    return;
  }

  const error = new Error(`CORS blocked for origin: ${origin ?? 'unknown'}`);
  console.warn('[cors] blocked request', { origin: origin ?? null });
  callback(error);
};

const corsOptions: cors.CorsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  },
  maxHttpBufferSize: 1e6
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    nodeEnv: env.NODE_ENV
  });
});

app.use('/api/auth', authRouter());
app.use('/api/profile', profileRouter());
app.use('/api/rooms', roomsRouter(roomManager));

registerSocketHandlers(io, roomManager);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = err instanceof Error ? err : new Error('Unknown server error');
  const isCorsError = /CORS blocked/i.test(error.message);

  if (isCorsError) {
    return res.status(403).json({
      success: false,
      message: 'Request blocked by CORS policy.',
      error: error.message
    });
  }

  console.error('[http:error] unhandled exception', error);
  return res.status(500).json({
    success: false,
    message: 'Internal server error.',
    error: env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : error.message
  });
});

const cleanupTimer = setInterval(() => {
  const removed = roomManager.cleanupExpiredRooms();
  removed.forEach((roomId) => {
    io.to(roomId).emit(SOCKET_EVENTS.ROOM_EXPIRED, { roomId });
  });
}, env.CLEANUP_INTERVAL_MS);

cleanupTimer.unref();

const start = async () => {
  await connectMongo();

  if (isMongoReady()) {
    const persistedRooms = await Room.find({}).lean();
    roomManager.hydrateFromStorage(
      persistedRooms.map((room: PersistedRoomRecord) => ({
        ...room,
        passwordHash: room.passwordHash ?? null
      }))
    );
  }

  server.listen(env.PORT, '0.0.0.0', () => {
    console.log('[CloudCanvas] backend started');
    console.log(`[CloudCanvas] port=${env.PORT}`);
    console.log(`[CloudCanvas] node_env=${env.NODE_ENV}`);
    console.log(`[CloudCanvas] allowed_client_origins=${allowedClientOrigins.join(',') || 'none'}`);
    if (!process.env.CLIENT_ORIGIN) {
      console.warn('[CloudCanvas] CLIENT_ORIGIN is not set; using safe defaults. Set CLIENT_ORIGIN in Render for strict production control.');
    }
  });
};

start().catch((error) => {
  console.error('[CloudCanvas] failed to start server', error);
  process.exit(1);
});
