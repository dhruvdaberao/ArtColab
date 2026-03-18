import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { connectMongo, isMongoReady } from '../db/mongo.js';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import type { RoomManager } from '../rooms/roomManager.js';
import { serializeSafeUser } from '../serializers/user.js';
import { generateGuestUsername, generateResetCode, hashResetCode, signGuestToken, signUserToken, verifyToken } from '../utils/auth.js';
import { sendPasswordResetCodeEmail } from '../utils/email.js';

const registerSchema = z
  .object({
    email: z.string().trim().email(),
    username: z.string().trim().min(3).max(32),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
    guestToken: z.string().trim().optional().nullable(),
    guestDisplayName: z.string().trim().min(1).max(32).optional()
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword']
  });

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(8).max(72),
  guestToken: z.string().trim().optional().nullable(),
  guestDisplayName: z.string().trim().min(1).max(32).optional()
});

const resetRequestSchema = z.object({
  email: z.string().trim().email()
});

const resetVerifySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().length(6),
  password: z.string().min(8).max(72),
  confirmPassword: z.string().min(8).max(72)
});

type GuestUpgradeContext = {
  guestId: string;
  guestUsername: string;
  guestDisplayName?: string;
};

const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };

const ensureMongo = async (res: Response): Promise<boolean> => {
  if (isMongoReady()) return true;

  const connected = await connectMongo();
  if (connected) return true;

  res.status(500).json({ success: false, message: 'Authentication database is unavailable.' });
  return false;
};

const getDuplicateMessage = (error: unknown): string => {
  const dup = error as { code?: number; keyPattern?: Record<string, number> };
  if (dup?.keyPattern?.email) return 'Email already in use.';
  if (dup?.keyPattern?.username) return 'Username already in use.';
  return 'Email or username already in use.';
};

const getGuestUpgradeContext = (candidate?: string | null, guestDisplayName?: string): GuestUpgradeContext | null => {
  if (!candidate) return null;

  try {
    const payload = verifyToken(candidate);
    if (payload.role !== 'guest') return null;

    return {
      guestId: payload.sub,
      guestUsername: payload.username,
      guestDisplayName: guestDisplayName?.trim() || undefined
    };
  } catch {
    return null;
  }
};

const migrateGuestData = async ({ roomManager, userId, username, upgrade }: { roomManager: RoomManager; userId: string; username: string; upgrade: GuestUpgradeContext | null }) => {
  if (!upgrade) return { createdRooms: [] as string[], joinedRooms: [] as string[] };

  const owner = { ownerId: userId, ownerType: 'user' as const, ownerName: username };
  const liveOwnedRoomIds = roomManager.transferRoomOwnership(upgrade.guestId, owner);
  const liveJoinedRoomIds = roomManager.getRoomIdsForParticipant(upgrade.guestId);

  const persistedOwnedRooms = await Room.find({ ownerType: 'guest', ownerId: upgrade.guestId }).select({ roomId: 1 }).lean();
  const persistedJoinedRooms = await Room.find({ roomId: { $in: liveJoinedRoomIds } }).select({ roomId: 1 }).lean();

  await Room.updateMany(
    { ownerType: 'guest', ownerId: upgrade.guestId },
    { $set: { ownerType: 'user', ownerId: userId, ownerName: username } }
  );

  const createdRooms = Array.from(new Set([...liveOwnedRoomIds, ...persistedOwnedRooms.map((room) => room.roomId)]));
  const joinedRooms = Array.from(new Set([...liveJoinedRoomIds, ...persistedJoinedRooms.map((room) => room.roomId)])).filter((roomId) => !createdRooms.includes(roomId));

  if (createdRooms.length || joinedRooms.length) {
    await User.findByIdAndUpdate(userId, {
      $addToSet: {
        ...(createdRooms.length ? { createdRooms: { $each: createdRooms } } : {}),
        ...(joinedRooms.length ? { joinedRooms: { $each: joinedRooms } } : {})
      }
    });
  }

  return { createdRooms, joinedRooms };
};

export const authRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.use((req, _res, next) => {
    console.info('[auth] incoming request', { method: req.method, path: req.path });
    next();
  });

  router.post('/guest', asyncHandler(async (_req: Request, res: Response) => {
    const username = generateGuestUsername();
    const token = signGuestToken({ sub: crypto.randomUUID(), username, role: 'guest' });
    res.status(201).json({ success: true, token, user: { username, role: 'guest' as const } });
  }));

  router.post('/register', asyncHandler(async (req: Request, res: Response) => {
    console.info('[auth] register request received');

    if (!await ensureMongo(res)) {
      console.error('[auth] register aborted: mongo unavailable');
      return;
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn('[auth] register validation failed', {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      });
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid registration payload.' });
    }

    const { email, username, password, guestToken, guestDisplayName } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const upgrade = getGuestUpgradeContext(guestToken, guestDisplayName);

    try {
      const existing = await User.findOne({
        $or: [{ email: normalizedEmail }, { username }]
      }).lean();

      if (existing) {
        const isEmailTaken = existing.email === normalizedEmail;
        console.info('[auth] register rejected: duplicate value', { duplicateField: isEmailTaken ? 'email' : 'username' });
        return res.status(409).json({ success: false, message: isEmailTaken ? 'Email already in use.' : 'Username already in use.' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      let user = await User.create({
        email: normalizedEmail,
        username,
        password: passwordHash
      });

      await migrateGuestData({ roomManager, userId: String(user._id), username: user.username, upgrade });
      user = (await User.findById(user._id)) ?? user;

      const token = signUserToken({ sub: String(user._id), username: user.username, email: user.email, role: 'user' });
      return res.status(201).json({ success: true, token, user: serializeSafeUser(user) });
    } catch (error) {
      const duplicateError = (error as { code?: number })?.code === 11000;
      if (duplicateError) {
        console.warn('[auth] register duplicate key from db layer', {
          message: (error as Error).message
        });
        return res.status(409).json({ success: false, message: getDuplicateMessage(error) });
      }

      console.error('[auth] register db failure', error);
      return res.status(500).json({ success: false, message: 'Unable to create account right now.' });
    }
  }));

  router.post('/login', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid login payload.' });
    }

    const { identifier, password, guestToken, guestDisplayName } = parsed.data;
    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'No account matched that email or username.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    await migrateGuestData({ roomManager, userId: String(user._id), username: user.username, upgrade: getGuestUpgradeContext(guestToken, guestDisplayName) });
    const refreshedUser = (await User.findById(user._id)) ?? user;

    const token = signUserToken({ sub: String(refreshedUser._id), username: refreshedUser.username, email: refreshedUser.email, role: 'user' });
    return res.json({ success: true, token, user: serializeSafeUser(refreshedUser) });
  }));

  router.post('/forgot-password/request', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;
    const parsed = resetRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });

    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'No account exists for that email address.' });

    const code = generateResetCode();
    user.resetCodeHash = hashResetCode(code);
    user.resetCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetCodeEmail(user.email, code);
    } catch (error) {
      console.error('[auth] failed to send reset email', error);
      return res.status(500).json({ success: false, message: 'Password reset email could not be sent.' });
    }

    return res.json({ success: true, message: 'A reset code has been sent to your email.' });
  }));

  router.post('/forgot-password/verify', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;
    const parsed = resetVerifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid reset payload.' });
    if (parsed.data.password !== parsed.data.confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });

    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.' });
    if (user.resetCodeExpiresAt.getTime() < Date.now()) return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.' });
    if (user.resetCodeHash !== hashResetCode(parsed.data.code)) return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.' });

    user.password = await bcrypt.hash(parsed.data.password, 12);
    user.resetCodeHash = null;
    user.resetCodeExpiresAt = null;
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  }));

  router.get('/me', asyncHandler(async (req: Request, res: Response) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!bearer) {
      return res.json({ success: true, user: null });
    }

    let payload: ReturnType<typeof verifyToken>;
    try {
      payload = verifyToken(bearer);
    } catch {
      return res.json({ success: true, user: null });
    }

    if (payload.role === 'guest') {
      return res.json({ success: true, user: { username: payload.username, role: 'guest' } });
    }

    if (!await ensureMongo(res)) return;
    const user = await User.findById(payload.sub).lean();
    if (!user) return res.json({ success: true, user: null });
    return res.json({ success: true, user: serializeSafeUser(user) });
  }));

  router.post('/logout', asyncHandler(async (_req: Request, res: Response) => {
    return res.json({ success: true });
  }));

  return router;
};
