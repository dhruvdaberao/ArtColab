import mongoose from 'mongoose';
import { env } from '../config/env.js';

let isConnected = false;

export const connectMongo = async () => {
  if (!env.MONGODB_URI) {
    console.warn('[mongo] MONGODB_URI not configured. Auth and profile endpoints will be unavailable.');
    return;
  }

  if (isConnected) return;

  await mongoose.connect(env.MONGODB_URI);
  isConnected = true;
  console.log('[mongo] connected');
};

export const isMongoReady = (): boolean => isConnected;
