import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { uploadProfileImage } from '../utils/cloudinary.js';

const profileSchema = z.object({
  username: z.string().trim().min(3).max(32).optional(),
  email: z.string().trim().email().optional(),
  profileImageDataUri: z.string().trim().optional()
});

type SafeUserSource = {
  _id: string;
  username: string;
  email: string;
  profileImage?: string;
  createdRooms: string[];
  joinedRooms: string[];
  createdAt: Date;
  updatedAt: Date;
};

const safeUser = (user: SafeUserSource) => ({
  id: String(user._id),
  username: user.username,
  email: user.email,
  profileImage: user.profileImage || '',
  createdRooms: user.createdRooms,
  joinedRooms: user.joinedRooms,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  role: 'user' as const
});

export const profileRouter = () => {
  const router = Router();

  router.get('/', requireAuth, async (req: Request, res: Response) => {
    const user = await User.findById(req.auth!.sub).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, user: safeUser(user) });
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

    return res.json({ success: true, user: safeUser(user), message: 'Changes saved' });
  });

  return router;
};
