import bcrypt from 'bcryptjs';
import { Router, type Request, type Response } from 'express';
import { createRoomSchema, joinRoomHttpSchema, roomIdSchema, updateRoomSchema } from '../utils/validation.js';
import { isMongoReady } from '../db/mongo.js';
import { optionalAuth } from '../middleware/auth.js';
import { Room } from '../models/Room.js';
import { User } from '../models/User.js';
import { RoomManager } from '../rooms/roomManager.js';
import { serializeRoomSummary, withNormalizedPasswordHash, type RoomJoinSource } from '../serializers/room.js';

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const roomsRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.post('/create', optionalAuth, async (req: Request, res: Response) => {
    const parsedBody = createRoomSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, message: parsedBody.error.issues[0]?.message ?? 'Invalid create room payload.' });
    }

    const name = parsedBody.data.name.trim();
    const visibility = parsedBody.data.visibility;
    const owner = {
      ownerType: req.auth?.role === 'user' ? 'user' : 'guest',
      ownerId: req.auth?.sub ?? 'anonymous',
      ownerName: req.auth?.username ?? 'Guest'
    } as const;

    try {
      if (isMongoReady()) {
        const existingName = await Room.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
        if (existingName) {
          return res.status(409).json({ success: false, message: 'Room name is already taken.' });
        }
      } else {
        const existsInMemory = roomManager.listMeta().some((meta) => meta.name.toLowerCase() === name.toLowerCase());
        if (existsInMemory) return res.status(409).json({ success: false, message: 'Room name is already taken.' });
      }

      const passwordHash = visibility === 'private' ? await bcrypt.hash(parsedBody.data.password!.trim(), 10) : null;
      const room = roomManager.createRoom({ name, visibility, passwordHash, owner });

      if (isMongoReady()) {
        await Room.create({
          roomId: room.roomId,
          name,
          visibility,
          passwordHash,
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          ownerName: owner.ownerName,
          lastActiveAt: new Date(),
          canvasState: { strokes: [], lastSavedAt: null, version: 1 },
          previewImageUrl: null
        });
        if (req.auth?.role === 'user') {
          await User.findByIdAndUpdate(req.auth.sub, { $addToSet: { createdRooms: room.roomId } });
        }
      }

      return res.status(201).json({ success: true, room });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      return res.status(500).json({ success: false, message: 'Failed to create room.', error: errorMessage });
    }
  });

  router.post('/join', optionalAuth, async (req: Request, res: Response) => {
    const parsedBody = joinRoomHttpSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, message: parsedBody.error.issues[0]?.message ?? 'Invalid join room payload.' });
    }

    const name = parsedBody.data.name.trim();
    try {
      let roomMeta: (RoomJoinSource & { passwordHash: string | null }) | null = null;
      if (isMongoReady()) {
        const persistedRoom = await Room.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();
        roomMeta = persistedRoom ? withNormalizedPasswordHash(persistedRoom) : null;
      }

      if (!roomMeta) {
        roomMeta = roomManager.listMeta().find((meta) => meta.name.toLowerCase() === name.toLowerCase()) || null;
      }
      if (!roomMeta) return res.status(404).json({ success: false, message: 'Room not found.' });
      if (roomMeta.visibility !== parsedBody.data.visibility) return res.status(400).json({ success: false, message: 'Room visibility selection does not match.' });
      if (roomMeta.visibility === 'private') {
        const ok = roomMeta.passwordHash && parsedBody.data.password ? await bcrypt.compare(parsedBody.data.password.trim(), roomMeta.passwordHash) : false;
        if (!ok) return res.status(401).json({ success: false, message: 'Invalid room password.' });
      }
      if (!roomManager.getRoom(roomMeta.roomId)) return res.status(410).json({ success: false, message: 'Room is no longer active.' });

      if (req.auth?.role === 'user' && isMongoReady()) {
        await User.findByIdAndUpdate(req.auth.sub, { $addToSet: { joinedRooms: roomMeta.roomId } });
      }

      return res.json({ success: true, roomId: roomMeta.roomId });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to join room.', error: toErrorMessage(error) });
    }
  });

  router.get('/browse', optionalAuth, async (req: Request, res: Response) => {
    const query = String(req.query.q ?? '').trim().toLowerCase();
    try {
      let rooms = roomManager.listMeta();
      if (query) rooms = rooms.filter((room) => room.name.toLowerCase().includes(query));
      return res.json({ success: true, rooms: rooms.map((room) => serializeRoomSummary(room, roomManager.getRoom(room.roomId)?.participants.length ?? 0)) });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to browse rooms.', error: toErrorMessage(error) });
    }
  });

  router.get('/manage', optionalAuth, async (req: Request, res: Response) => {
    const myId = req.auth?.sub;
    if (!myId) return res.json({ success: true, ownedRooms: [], joinedRooms: [], message: 'Guest management only shows rooms from this active session.' });

    const rooms = roomManager.listMeta();
    const ownedRooms = rooms.filter((room) => room.ownerId === myId).map((room) => serializeRoomSummary(room, roomManager.getRoom(room.roomId)?.participants.length ?? 0));
    const user = req.auth && req.auth.role === 'user' && isMongoReady() ? await User.findById(req.auth.sub).lean() : null;
    const joinedRoomIds = new Set(user?.joinedRooms ?? []);
    const joinedRooms = rooms.filter((room) => joinedRoomIds.has(room.roomId)).map((room) => serializeRoomSummary(room, roomManager.getRoom(room.roomId)?.participants.length ?? 0));
    return res.json({ success: true, ownedRooms, joinedRooms });
  });

  router.patch('/:roomId/settings', optionalAuth, async (req: Request, res: Response) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    const parsedBody = updateRoomSchema.safeParse(req.body ?? {});
    if (!parsedId.success || !parsedBody.success) return res.status(400).json({ success: false, message: 'Invalid room settings payload.' });

    const meta = roomManager.getMeta(parsedId.data);
    if (!meta) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (!req.auth || meta.ownerId !== req.auth.sub) return res.status(403).json({ success: false, message: 'Only room owner can update room settings.' });

    const updates: Partial<Pick<RoomJoinSource, 'name' | 'visibility'> & { passwordHash: string | null }> = {};
    if (parsedBody.data.name && parsedBody.data.name.trim().toLowerCase() !== meta.name.toLowerCase()) {
      const candidate = parsedBody.data.name.trim();
      const exists = roomManager.listMeta().some((item) => item.roomId !== meta.roomId && item.name.toLowerCase() === candidate.toLowerCase());
      if (exists) return res.status(409).json({ success: false, message: 'Room name is already taken.' });
      updates.name = candidate;
    }
    if (parsedBody.data.visibility) updates.visibility = parsedBody.data.visibility;
    if (parsedBody.data.visibility === 'private' || (meta.visibility === 'private' && parsedBody.data.password)) {
      updates.passwordHash = parsedBody.data.password ? await bcrypt.hash(parsedBody.data.password.trim(), 10) : meta.passwordHash;
    }
    if (parsedBody.data.visibility === 'public') updates.passwordHash = null;

    Object.assign(meta, updates, { updatedAt: Date.now() });
    if (isMongoReady()) {
      await Room.findOneAndUpdate({ roomId: meta.roomId }, { $set: updates });
    }
    return res.json({ success: true, room: serializeRoomSummary(meta, roomManager.getRoom(meta.roomId)?.participants.length ?? 0) });
  });

  router.delete('/:roomId', optionalAuth, async (req: Request, res: Response) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    if (!parsedId.success) return res.status(400).json({ success: false, message: 'Invalid room ID format.' });
    const meta = roomManager.getMeta(parsedId.data);
    if (!meta) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (!req.auth || meta.ownerId !== req.auth.sub) return res.status(403).json({ success: false, message: 'Only room owner can delete this room.' });
    roomManager.deleteRoom(parsedId.data);
    if (isMongoReady()) await Room.deleteOne({ roomId: parsedId.data });
    return res.json({ success: true });
  });

  router.post('/:roomId/leave', optionalAuth, async (req: Request, res: Response) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    if (!parsedId.success) return res.status(400).json({ success: false, message: 'Invalid room ID format.' });
    if (req.auth?.role === 'user' && isMongoReady()) {
      await User.findByIdAndUpdate(req.auth.sub, { $pull: { joinedRooms: parsedId.data } });
    }
    return res.json({ success: true });
  });

  router.get('/:roomId', optionalAuth, async (req: Request, res: Response) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    if (!parsedId.success) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format.', error: 'INVALID_ROOM_ID' });
    }

    try {
      const room = roomManager.getRoom(parsedId.data);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Room does not exist or has expired.', error: 'ROOM_NOT_FOUND' });
      }

      if (req.auth?.role === 'user' && isMongoReady()) {
        await User.findByIdAndUpdate(req.auth.sub, { $addToSet: { joinedRooms: parsedId.data } });
      }

      return res.json({ success: true, room });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      return res.status(500).json({ success: false, message: 'Failed to fetch room.', error: errorMessage });
    }
  });

  return router;
};
