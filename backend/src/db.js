import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { config } from './config.js';

let memoryServer = null;

export async function connectDb() {
  let uri = config.mongoUri;

  if (config.useInMemoryDb) {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { storageEngine: 'wiredTiger' }
    });
    uri = memoryServer.getUri('upimesh');
    console.log('Using in-memory MongoDB replica set (zero setup, like H2)');
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
