import { Router } from 'express';
import { roomIdSchema } from '../utils/validation.js';
import { RoomManager } from '../rooms/roomManager.js';

export const roomsRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.post('/create', (_req, res) => {
    try {
      const room = roomManager.createRoom();
      return res.status(201).json({ room });
    } catch (error) {
      console.error('[rooms:create] failed to create room', error);
      return res.status(500).json({ message: 'Failed to create room.' });
    }
  });

  router.get('/:roomId', (req, res) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    if (!parsedId.success) {
      console.warn('[rooms:get] invalid room id format', { roomId: req.params.roomId });
      return res.status(400).json({ message: 'Invalid room ID format.' });
    }

    try {
      const room = roomManager.getRoom(parsedId.data);
      if (!room) {
        console.warn('[rooms:get] room missing or expired', { roomId: parsedId.data });
        return res.status(404).json({ message: 'Room does not exist or has expired.' });
      }
      return res.json({ room });
    } catch (error) {
      console.error('[rooms:get] failed to fetch room', { roomId: parsedId.data, error });
      return res.status(500).json({ message: 'Failed to fetch room.' });
    }
  });

  return router;
};
