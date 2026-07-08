import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { config } from './config.js';

let memoryServer = null;

export async function connectDb() {
  let uri = config.mongoUri;

  if (config.useInMemoryDb) {
    try {
      memoryServer = await MongoMemoryReplSet.create({
        replSet: { storageEngine: 'wiredTiger' }
      });
      uri = memoryServer.getUri('upimesh');
      console.log('Using in-memory MongoDB replica set (zero setup, like H2)');
    } catch (err) {
      console.warn('⚠️ FAILED to start native MongoMemoryReplSet (likely due to Serverless environment constraints):', err.message);
      console.warn('🔄 Falling back to mock in-memory JS database...');
      global.useMockDb = true;
      return;
    }
  } else if (!uri) {
    console.warn('⚠️ MONGODB_URI is not set. Falling back to mock in-memory JS database...');
    global.useMockDb = true;
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected');
  } catch (err) {
    console.warn('⚠️ Connection to MongoDB failed:', err.message);
    console.warn('🔄 Falling back to mock in-memory JS database...');
    global.useMockDb = true;
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
