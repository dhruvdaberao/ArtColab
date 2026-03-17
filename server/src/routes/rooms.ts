import { Router } from 'express';
import { createRoomSchema, roomIdSchema } from '../utils/validation.js';
import { isMongoReady } from '../db/mongo.js';
import { optionalAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { RoomManager } from '../rooms/roomManager.js';

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const roomsRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.post('/create', optionalAuth, async (req, res) => {
    const parsedBody = createRoomSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({ success: false, message: 'Invalid create room payload.', error: parsedBody.error.issues.map((issue) => issue.message).join(', ') });
    }

    try {
      const room = roomManager.createRoom();

      if (req.auth?.role === 'user' && isMongoReady()) {
        await User.findByIdAndUpdate(req.auth.sub, { $addToSet: { createdRooms: room.roomId } });
      }

      return res.status(201).json({ success: true, room });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      return res.status(500).json({ success: false, message: 'Failed to create room.', error: errorMessage });
    }
  });

  router.get('/:roomId', optionalAuth, async (req, res) => {
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
