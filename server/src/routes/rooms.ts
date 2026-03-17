import { Router } from 'express';
import { createRoomSchema, roomIdSchema } from '../utils/validation.js';
import { RoomManager } from '../rooms/roomManager.js';

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const roomsRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.post('/create', (req, res) => {
    const parsedBody = createRoomSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      console.warn('[rooms:create] invalid request body', {
        issues: parsedBody.error.issues,
        body: req.body
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid create room payload.',
        error: parsedBody.error.issues.map((issue) => issue.message).join(', ')
      });
    }

    try {
      const room = roomManager.createRoom();
      return res.status(201).json({ success: true, room });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      console.error('[rooms:create] failed to create room', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        origin: req.headers.origin,
        userAgent: req.headers['user-agent']
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to create room.',
        error: errorMessage
      });
    }
  });

  router.get('/:roomId', (req, res) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    if (!parsedId.success) {
      console.warn('[rooms:get] invalid room id format', { roomId: req.params.roomId });
      return res.status(400).json({ success: false, message: 'Invalid room ID format.', error: 'INVALID_ROOM_ID' });
    }

    try {
      const room = roomManager.getRoom(parsedId.data);
      if (!room) {
        console.warn('[rooms:get] room missing or expired', { roomId: parsedId.data });
        return res.status(404).json({ success: false, message: 'Room does not exist or has expired.', error: 'ROOM_NOT_FOUND' });
      }
      return res.json({ success: true, room });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      console.error('[rooms:get] failed to fetch room', { roomId: parsedId.data, error: errorMessage });
      return res.status(500).json({ success: false, message: 'Failed to fetch room.', error: errorMessage });
    }
  });

  return router;
};
