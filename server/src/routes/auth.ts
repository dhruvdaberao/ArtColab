import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { connectMongo, isMongoReady } from '../db/mongo.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import type { RoomManager } from '../rooms/roomManager.js';
import { serializeSafeUser } from '../serializers/user.js';
import { areResetCodeHashesEqual, generateGuestUsername, generateResetCode, hashResetCode, signGuestToken, signUserToken, verifyToken } from '../utils/auth.js';
import { EmailDeliveryError, sendOTPEmail } from '../utils/email.js';

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

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, 'Reset code must be 6 digits.')
});

const resetPasswordSchema = z
  .object({
    email: z.string().trim().email(),
    resetToken: z.string().trim().min(32),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72)
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword']
  });

type GuestUpgradeContext = {
  guestId: string;
  guestUsername: string;
  guestDisplayName?: string;
};

const RESET_CODE_TTL_MS = env.OTP_EXPIRES_MINUTES * 60 * 1000;
const RESET_SESSION_TTL_MS = 10 * 60 * 1000;

const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };

const ensureMongo = async (res: Response): Promise<boolean> => {
  if (isMongoReady()) return true;

  const connected = await connectMongo();
  if (connected) return true;

  res.status(500).json({ success: false, message: 'Authentication database is unavailable.', code: 'AUTH_DB_UNAVAILABLE' });
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

const mapEmailErrorToResponse = (error: EmailDeliveryError) => {
  switch (error.code) {
    case 'EMAIL_NOT_CONFIGURED':
      return {
        status: 503,
        payload: {
          success: false,
          message: 'Failed to send OTP. Try again.',
          code: error.code
        }
      };
    case 'EMAIL_PROVIDER_REJECTED':
      return {
        status: 503,
        payload: {
          success: false,
          message: 'Failed to send OTP. Try again.',
          code: error.code
        }
      };
    default:
      return {
        status: 503,
        payload: {
          success: false,
          message: 'Failed to send OTP. Try again.',
          code: error.code
        }
      };
  }
};

const clearResetState = async (user: any) => {
  user.resetCodeHash = null;
  user.resetCodeExpiresAt = null;
  user.resetSessionHash = null;
  user.resetSessionExpiresAt = null;
  await user.save();
};

const issueResetSession = async (user: any) => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetSessionHash = hashResetCode(resetToken);
  user.resetSessionExpiresAt = new Date(Date.now() + RESET_SESSION_TTL_MS);
  user.resetCodeHash = null;
  user.resetCodeExpiresAt = null;
  await user.save();
  return resetToken;
};

export const authRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.use((req, _res, next) => {
    console.info('[auth] incoming request', { method: req.method, path: req.path });
    next();
  });

  router.post('/guest', asyncHandler(async (_req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const username = generateGuestUsername();
      const token = signGuestToken({ sub: crypto.randomUUID(), username, role: 'guest' });
      return res.status(201).json({ success: true, token, user: { username, role: 'guest' as const } });
    } catch (error) {
      console.error('[auth] guest session creation failed', error);
      return res.status(500).json({ success: false, message: 'Failed to start guest session.', code: 'GUEST_SESSION_FAILED' });
    } finally {
      console.info('[auth] guest request completed', { durationMs: Date.now() - startedAt });
    }
  }));

  router.post('/register', asyncHandler(async (req: Request, res: Response) => {
    console.info('[auth] register request received');

    if (!await ensureMongo(res)) return;

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid registration payload.' });
    }

    const { email, username, password, guestToken, guestDisplayName } = parsed.data;

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      const created = await User.create({
        email: email.toLowerCase(),
        username,
        password: passwordHash
      });

      await migrateGuestData({ roomManager, userId: String(created._id), username: created.username, upgrade: getGuestUpgradeContext(guestToken, guestDisplayName) });
      const token = signUserToken({ sub: String(created._id), username: created.username, email: created.email, role: 'user' });
      return res.status(201).json({ success: true, token, user: serializeSafeUser(created) });
    } catch (error) {
      console.error('[auth] register failed', error);
      return res.status(400).json({ success: false, message: getDuplicateMessage(error) });
    }
  }));

  router.post('/login', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Please provide your email/username and password.' });
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
    if (!parsed.success) {
      console.warn('[auth] forgot-password request validation failed', {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      });
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.', code: 'INVALID_EMAIL' });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    console.info('[auth] forgot-password request received', { email: normalizedEmail });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.warn('[auth] forgot-password request user not found', { email: normalizedEmail });
      return res.status(404).json({ success: false, message: 'No account exists for that email address.', code: 'ACCOUNT_NOT_FOUND' });
    }

    const otp = generateResetCode();
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);

    user.resetCodeHash = hashResetCode(otp);
    user.resetCodeExpiresAt = expiresAt;
    user.resetSessionHash = null;
    user.resetSessionExpiresAt = null;
    await user.save();

    try {
      await sendOTPEmail(user.email, otp);
    } catch (error) {
      console.error('[auth] forgot-password email send failed', {
        userId: String(user._id),
        email: user.email,
        error: error instanceof Error ? { name: error.name, message: error.message } : error
      });

      await clearResetState(user);

      if (error instanceof EmailDeliveryError) {
        const response = mapEmailErrorToResponse(error);
        return res.status(response.status).json(response.payload);
      }

      return res.status(503).json({
        success: false,
        message: 'Failed to send OTP. Try again.',
        code: 'EMAIL_SEND_FAILED'
      });
    }

    return res.json({ success: true, message: 'OTP sent to your email', expiresInMinutes: env.OTP_EXPIRES_MINUTES });
  }));

  router.post('/forgot-password/verify-otp', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;

    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid reset payload.', code: 'INVALID_RESET_PAYLOAD' });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      return res.status(400).json({ success: false, message: 'OTP is invalid or expired.', code: 'RESET_CODE_INVALID' });
    }

    if (user.resetCodeExpiresAt.getTime() < Date.now()) {
      await clearResetState(user);
      return res.status(400).json({ success: false, message: 'OTP is invalid or expired.', code: 'RESET_CODE_EXPIRED' });
    }

    if (!areResetCodeHashesEqual(user.resetCodeHash, parsed.data.otp)) {
      return res.status(400).json({ success: false, message: 'OTP is invalid or expired.', code: 'RESET_CODE_INVALID' });
    }

    const resetToken = await issueResetSession(user);
    return res.json({ success: true, message: 'OTP verified successfully.', resetToken, resetTokenExpiresInMinutes: RESET_SESSION_TTL_MS / 60000 });
  }));

  router.post('/forgot-password/reset-password', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;

    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid reset payload.', code: 'INVALID_RESET_PAYLOAD' });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.resetSessionHash || !user.resetSessionExpiresAt) {
      return res.status(400).json({ success: false, message: 'Reset session is invalid or expired.', code: 'RESET_SESSION_INVALID' });
    }

    if (user.resetSessionExpiresAt.getTime() < Date.now()) {
      await clearResetState(user);
      return res.status(400).json({ success: false, message: 'Reset session is invalid or expired.', code: 'RESET_SESSION_EXPIRED' });
    }

    if (!areResetCodeHashesEqual(user.resetSessionHash, parsed.data.resetToken)) {
      return res.status(400).json({ success: false, message: 'Reset session is invalid or expired.', code: 'RESET_SESSION_INVALID' });
    }

    user.password = await bcrypt.hash(parsed.data.password, 12);
    user.resetCodeHash = null;
    user.resetCodeExpiresAt = null;
    user.resetSessionHash = null;
    user.resetSessionExpiresAt = null;
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  }));

  router.post('/forgot-password/verify', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;

    const otpParsed = verifyOtpSchema.safeParse({ email: req.body?.email, otp: req.body?.code });
    if (!otpParsed.success) {
      return res.status(400).json({ success: false, message: otpParsed.error.issues[0]?.message || 'Invalid reset payload.', code: 'INVALID_RESET_PAYLOAD' });
    }

    const passwordParsed = resetPasswordSchema.safeParse({
      email: req.body?.email,
      resetToken: 'placeholder-placeholder-placeholder-placeholder',
      password: req.body?.password,
      confirmPassword: req.body?.confirmPassword
    });
    if (!passwordParsed.success && passwordParsed.error.issues.some((issue) => issue.path[0] !== 'resetToken')) {
      return res.status(400).json({ success: false, message: passwordParsed.error.issues[0]?.message || 'Invalid reset payload.', code: 'INVALID_RESET_PAYLOAD' });
    }

    const user = await User.findOne({ email: otpParsed.data.email.toLowerCase() });
    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.', code: 'RESET_CODE_INVALID' });
    }
    if (user.resetCodeExpiresAt.getTime() < Date.now()) {
      await clearResetState(user);
      return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.', code: 'RESET_CODE_EXPIRED' });
    }
    if (!areResetCodeHashesEqual(user.resetCodeHash, otpParsed.data.otp)) {
      return res.status(400).json({ success: false, message: 'Reset code is invalid or expired.', code: 'RESET_CODE_INVALID' });
    }

    user.password = await bcrypt.hash(req.body.password, 12);
    user.resetCodeHash = null;
    user.resetCodeExpiresAt = null;
    user.resetSessionHash = null;
    user.resetSessionExpiresAt = null;
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
