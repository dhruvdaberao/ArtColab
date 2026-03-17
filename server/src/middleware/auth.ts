import type { NextFunction, Request, Response } from 'express';
import { type AuthTokenPayload, type GuestTokenPayload, verifyToken } from '../utils/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload | GuestTokenPayload;
    }
  }
}

const getToken = (req: Request): string | null => {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  return bearer || null;
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = getToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.auth = verifyToken(token);
  } catch {
    req.auth = undefined;
  }

  next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  try {
    const payload = verifyToken(token);
    if (payload.role !== 'user') {
      res.status(403).json({ success: false, message: 'Registered account required.' });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};
