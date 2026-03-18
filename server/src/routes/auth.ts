import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { connectMongo, isMongoReady } from '../db/mongo.js';
import { optionalAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { serializeSafeUser } from '../serializers/user.js';
import { generateGuestUsername, generateResetCode, hashResetCode, signGuestToken, signUserToken } from '../utils/auth.js';
import { sendPasswordResetCodeEmail } from '../utils/email.js';

const registerSchema = z
  .object({
    email: z.string().trim().email(),
    username: z.string().trim().min(3).max(32),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72)
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword']
  });

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(8).max(72)
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

export const authRouter = () => {
  const router = Router();

  router.use((req, _res, next) => {
    console.info('[auth] incoming request', { method: req.method, path: req.path });
    next();
  });

  router.post('/guest', optionalAuth, asyncHandler(async (_req: Request, res: Response) => {
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

    const { email, username, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

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
      const user = await User.create({
        email: normalizedEmail,
        username,
        password: passwordHash
      });

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
      return res.status(400).json({ success: false, message: 'Invalid login payload.' });
    }

    const { identifier, password } = parsed.data;
    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = signUserToken({ sub: String(user._id), username: user.username, email: user.email, role: 'user' });
    return res.json({ success: true, token, user: serializeSafeUser(user) });
  }));

  router.post('/forgot-password/request', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;
    const parsed = resetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({ success: true, message: 'If an account exists, a reset code has been sent.' });
    }

    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (user) {
      const code = generateResetCode();
      user.resetCodeHash = hashResetCode(code);
      user.resetCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      try {
        await sendPasswordResetCodeEmail(user.email, code);
      } catch (error) {
        console.error('[auth] failed to send reset email', error);
      }
    }

    return res.status(200).json({ success: true, message: 'If an account exists, a reset code has been sent.' });
  }));

  router.post('/forgot-password/verify', asyncHandler(async (req: Request, res: Response) => {
    if (!await ensureMongo(res)) return;
    const parsed = resetVerifySchema.safeParse(req.body);
    if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
      return res.status(400).json({ success: false, message: 'Invalid reset data.' });
    }

    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    const isExpired = user.resetCodeExpiresAt.getTime() < Date.now();
    const isCodeValid = user.resetCodeHash === hashResetCode(parsed.data.code);

    if (!isCodeValid || isExpired) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    user.password = await bcrypt.hash(parsed.data.password, 12);
    user.resetCodeHash = null;
    user.resetCodeExpiresAt = null;
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully.' });
  }));

  router.get('/me', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) {
      return res.json({ success: true, user: null });
    }

    if (req.auth.role === 'guest') {
      return res.json({ success: true, user: { username: req.auth.username, role: 'guest' } });
    }

    if (!await ensureMongo(res)) return;
    const user = await User.findById(req.auth.sub).lean();
    if (!user) {
      return res.json({ success: true, user: null });
    }

    return res.json({ success: true, user: serializeSafeUser(user) });
  }));

  router.post('/logout', (_req, res) => {
    res.json({ success: true });
  });

  return router;
};
