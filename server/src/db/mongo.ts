import mongoose from 'mongoose';
import { env } from '../config/env.js';

let isConnected = false;
let didConnectionFail = false;

export const connectMongo = async () => {
  if (!env.MONGODB_URI) {
    console.warn('[mongo] MONGODB_URI/MONGO_URI not configured. Auth and profile endpoints will be unavailable.');
    return false;
  }

  if (isConnected) return true;

  try {
    await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    didConnectionFail = false;
    console.log('[mongo] connected');
    return true;
  } catch (error) {
    didConnectionFail = true;
    isConnected = false;
    console.error('[mongo] connection failed', error);
    return false;
  }
};

export const isMongoReady = (): boolean => isConnected;

export const didMongoConnectionFail = (): boolean => didConnectionFail;
