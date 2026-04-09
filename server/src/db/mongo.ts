import mongoose from 'mongoose';

let isConnected = false;
let didConnectionFail = false;
let connectionPromise: Promise<boolean> | null = null;

const maskMongoUri = (uri: string): string => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

const validateMongoUri = (uri: string) => {
  const hasSrv = uri.startsWith('mongodb+srv://');
  const hasFroodleDbName = /mongodb\+srv:\/\/[^/]+\/froodle(?:\?|$)/i.test(uri);
  const hasRetryWrites = /[?&]retryWrites=true(?:&|$)/i.test(uri);
  const hasMajority = /[?&]w=majority(?:&|$)/i.test(uri);

  console.info('[mongo] uri validation', {
    hasSrv,
    hasFroodleDbName,
    hasRetryWrites,
    hasMajority
  });
};

export const connectMongo = async () => {
  const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('[mongo] MONGO_URI/MONGODB_URI not configured. Auth and profile endpoints will be unavailable.');
    didConnectionFail = true;
    return false;
  }

  console.info('[mongo] attempting connection', { uri: maskMongoUri(mongoUri) });
  validateMongoUri(mongoUri);

  if (isConnected) return true;
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    } as mongoose.ConnectOptions & { useNewUrlParser: boolean; useUnifiedTopology: boolean })
    .then(() => {
      isConnected = true;
      didConnectionFail = false;
      console.log('MongoDB Connected');
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
