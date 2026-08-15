import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dns from 'dns';
import { env } from './env';

// Set public DNS servers to guarantee SRV TXT record resolution on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if fails in some environment
}

let mongoMemoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  const dbUrl = env.DATABASE_URL || env.MONGODB_URI;

  if (env.USE_MEMORY_DB) {
    console.log('⚡ Starting MongoMemoryServer for local development...');
    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`✅ Connected to MongoMemoryServer at ${uri}`);
    return conn;
  }

  try {
    const conn = await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`✅ Successfully connected to MongoDB Atlas at ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
    return conn;
  } catch (err: any) {
    console.warn(`⚠️ Could not connect to MongoDB Atlas (${err.message}). Falling back to MongoMemoryServer...`);
    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`✅ Connected to MongoMemoryServer fallback at ${uri}`);
    return conn;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}
