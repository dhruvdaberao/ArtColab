import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AuthTokenPayload = {
  sub: string;
  username: string;
  email: string;
  role: 'user';
};

export type GuestTokenPayload = {
  sub: string;
  username: string;
  role: 'guest';
};

export const signUserToken = (payload: AuthTokenPayload) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

export const signGuestToken = (payload: GuestTokenPayload) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });

export const verifyToken = (token: string): AuthTokenPayload | GuestTokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload | GuestTokenPayload;
};

export const hashResetCode = (code: string): string => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

export const areResetCodeHashesEqual = (storedHash: string, candidateCode: string): boolean => {
  const storedBuffer = Buffer.from(storedHash, 'hex');
  const candidateBuffer = Buffer.from(hashResetCode(candidateCode), 'hex');

  if (storedBuffer.length !== candidateBuffer.length) return false;

  return crypto.timingSafeEqual(storedBuffer, candidateBuffer);
};

export const generateResetCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const generateGuestUsername = (): string => `Guest-${crypto.randomInt(100, 10000)}`;
