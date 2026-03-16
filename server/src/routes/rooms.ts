import { Router } from 'express';
import { roomIdSchema } from '../utils/validation.js';
import { RoomManager } from '../rooms/roomManager.js';

export const roomsRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.post('/create', (_req, res) => {
    const room = roomManager.createRoom();
    res.status(201).json({ room });
  });

  router.get('/:roomId', (req, res) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    if (!parsedId.success) {
      return res.status(400).json({ message: 'Invalid room ID format.' });
    }
    const room = roomManager.getRoom(parsedId.data);
    if (!room) {
      return res.status(404).json({ message: 'Room does not exist or has expired.' });
    }
    return res.json({ room });
  });

  return router;
};
