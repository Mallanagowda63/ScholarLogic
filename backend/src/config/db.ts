import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import dns from 'dns';
import { env } from './env';

// Set public DNS servers to guarantee SRV TXT record resolution on Windows
try {
  // IPv4 first, then IPv6 resolvers for IPv6-only networks (e.g. phone hotspots)
  dns.setServers(['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888', '2606:4700:4700::1111']);
} catch (e) {
  // Ignore if fails in some environment
}

// Single-node replica set so multi-document transactions (student registration) work in memory mode
let mongoMemoryServer: MongoMemoryReplSet | null = null;
const startMemoryDb = () =>
  MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ launchTimeout: 60000 }] });

export async function connectDB(): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  // Reuse an open connection (tests call connectDB more than once)
  if (mongoose.connection.readyState === 1) return mongoose;

  const dbUrl = env.DATABASE_URL || env.MONGODB_URI;

  if (env.USE_MEMORY_DB) {
    console.log('⚡ Starting MongoMemoryServer for local development...');
    mongoMemoryServer = await startMemoryDb();
    const uri = mongoMemoryServer.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`✅ Connected to MongoMemoryServer at ${uri}`);
    return conn;
  }

  // Atlas can be slow to answer on a weak connection: try a few times before giving up
  let lastError: any;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const conn = await mongoose.connect(dbUrl, {
        serverSelectionTimeoutMS: 15000,
        // Prefer IPv4: some networks (e.g. phone hotspots) route IPv6 through NAT64, which Atlas drops
        family: 4,
        // Notice a dead connection sooner and replace it, instead of failing requests on it
        heartbeatFrequencyMS: 5000,
        maxIdleTimeMS: 60000,
        retryReads: true,
        retryWrites: true,
      });
      console.log(`✅ Successfully connected to MongoDB Atlas at ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
      return conn;
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ MongoDB Atlas not reachable (attempt ${attempt} of 4): ${err.message}`);
      if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  // An empty in-memory database looks like "all data gone"; only use it when explicitly allowed
  if (process.env.ALLOW_MEMORY_DB_FALLBACK !== 'true') {
    throw new Error(`Cannot reach MongoDB Atlas (${lastError?.message}). Check the internet connection and try again.`);
  }
  {
    console.warn(`⚠️ Could not connect to MongoDB Atlas (${lastError?.message}). Falling back to MongoMemoryServer (ALLOW_MEMORY_DB_FALLBACK=true)...`);
    mongoMemoryServer = await startMemoryDb();
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
