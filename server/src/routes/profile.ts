import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { SOCKET_EVENTS } from '@cloudcanvas/shared';
import type { Server } from 'socket.io';
import { requireAuth } from '../middleware/auth.js';
import { Room } from '../models/Room.js';
import { User } from '../models/User.js';
import type { RoomManager } from '../rooms/roomManager.js';
import { serializeSafeUser } from '../serializers/user.js';
import { destroyProfileImage, uploadProfileImage } from '../utils/cloudinary.js';

const profileSchema = z.object({
  username: z.string().trim().min(3).max(32).optional(),
  email: z.string().trim().email().optional(),
  profileImageDataUri: z.string().trim().optional()
});

const deleteAccountSchema = z.object({
  confirmationText: z.literal('DELETE'),
  password: z.string().min(8).max(72).optional()
});

const emitOwnedRoomDeletion = (io: Server, roomId: string) => {
  io.to(roomId).emit(SOCKET_EVENTS.ROOM_EXPIRED, {
    roomId,
    reason: 'ACCOUNT_DELETED',
    message: 'This room was deleted because its owner deleted their account.'
  });
};

const emitParticipantsUpdated = (io: Server, roomId: string, roomManager: RoomManager) => {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  io.to(roomId).emit(SOCKET_EVENTS.ROOM_PARTICIPANTS_UPDATED, {
    roomId,
    participants: room.participants
  });
};

export const profileRouter = (roomManager: RoomManager, io: Server) => {
  const router = Router();

  router.get('/', requireAuth, async (req: Request, res: Response) => {
    const user = await User.findById(req.auth!.sub).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, user: serializeSafeUser(user) });
  });

  router.patch('/', requireAuth, async (req: Request, res: Response) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid profile payload.' });
    }

    const user = await User.findById(req.auth!.sub);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (parsed.data.username && parsed.data.username !== user.username) {
      const exists = await User.findOne({ username: parsed.data.username, _id: { $ne: user._id } }).lean();
      if (exists) {
        return res.status(409).json({ success: false, message: 'Username is already taken.' });
      }
      user.username = parsed.data.username;
    }

    if (parsed.data.email && parsed.data.email.toLowerCase() !== user.email) {
      const exists = await User.findOne({ email: parsed.data.email.toLowerCase(), _id: { $ne: user._id } }).lean();
      if (exists) {
        return res.status(409).json({ success: false, message: 'Email is already taken.' });
      }
      user.email = parsed.data.email.toLowerCase();
    }

    if (parsed.data.profileImageDataUri) {
      user.profileImage = await uploadProfileImage(parsed.data.profileImageDataUri);
    }

    await user.save();

    return res.json({ success: true, user: serializeSafeUser(user), message: 'Changes saved' });
  });

  router.delete('/account', requireAuth, async (req: Request, res: Response) => {
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid delete account payload.' });
    }

    const session = await mongoose.startSession();
    let deletedRoomIds: string[] = [];
    let profileImageUrl = '';

    try {
      await session.withTransaction(async () => {
        const user = await User.findById(req.auth!.sub).session(session);
        if (!user) {
          throw new Error('USER_NOT_FOUND');
        }

        const passwordMatches = await bcrypt.compare(parsed.data.password ?? '', user.password);
        if (!passwordMatches) {
          throw new Error('INVALID_PASSWORD');
        }

        const ownedRooms = await Room.find({ ownerType: 'user', ownerId: req.auth!.sub }).session(session).select({ roomId: 1 }).lean();
        deletedRoomIds = ownedRooms.map((room) => room.roomId);
        profileImageUrl = user.profileImage ?? '';

        if (deletedRoomIds.length) {
          await Room.deleteMany({ roomId: { $in: deletedRoomIds } }).session(session);
          await User.updateMany(
            { _id: { $ne: user._id } },
            {
              $pull: {
                createdRooms: { $in: deletedRoomIds },
                joinedRooms: { $in: deletedRoomIds }
              }
            },
            { session }
          );
        }
        await User.deleteOne({ _id: user._id }).session(session);
      });
    } catch (error) {
      console.error('[profile] delete account failed', { userId: req.auth?.sub, error });
      await session.endSession();

      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
        return res.status(403).json({ success: false, message: 'Password confirmation failed.' });
      }

      return res.status(500).json({ success: false, message: 'Failed to delete account.' });
    }

    await session.endSession();

    deletedRoomIds.forEach((roomId) => {
      emitOwnedRoomDeletion(io, roomId);
      roomManager.deleteRoom(roomId);
    });

    const affectedJoinedRooms = roomManager.removeParticipantByUserId(req.auth!.sub);
    affectedJoinedRooms
      .filter((roomId) => !deletedRoomIds.includes(roomId))
      .forEach((roomId) => emitParticipantsUpdated(io, roomId, roomManager));

    if (profileImageUrl) {
      void destroyProfileImage(profileImageUrl).catch((error) => {
        console.warn('[profile] failed to remove profile image asset', { userId: req.auth?.sub, error });
      });
    }

    return res.json({
      success: true,
      deletedRoomIds,
      message: 'Your account has been deleted.'
    });
  });

  return router;
};
