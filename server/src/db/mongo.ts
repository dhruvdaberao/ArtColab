import mongoose from 'mongoose';
import { env } from '../config/env.js';

let isConnected = false;
let didConnectionFail = false;
let connectionPromise: Promise<boolean> | null = null;

export const connectMongo = async () => {
  if (!env.MONGODB_URI) {
    console.warn('[mongo] MONGODB_URI/MONGO_URI not configured. Auth and profile endpoints will be unavailable.');
    didConnectionFail = true;
    return false;
  }

  if (isConnected) return true;
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(env.MONGODB_URI)
    .then(() => {
      isConnected = true;
      didConnectionFail = false;
      console.log('[mongo] connected');
      return true;
    })
    .catch((error) => {
      didConnectionFail = true;
      isConnected = false;
      console.error('[mongo] connection failed', error);
      return false;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
};

export const isMongoReady = (): boolean => isConnected;

export const didMongoConnectionFail = (): boolean => didConnectionFail;
