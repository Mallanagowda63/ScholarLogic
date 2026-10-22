import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { seedDatabase } from './scripts/seed';
import { seedTracking } from './scripts/seedTracking';
import { seedTestData, assertSafeToSeed } from './scripts/seedTestData';
import { startAutoSync } from './services/googleFormService';
import { startMachinePull } from './services/esslPullService';

async function startServer() {
  try {
    await connectDB();

    // Auto-seed initial demo data if database is empty
    await seedDatabase(false);
    // Batch-tracking sample data only for the throwaway in-memory DB (tests / local demo)
    if (env.USE_MEMORY_DB && process.env.SEED_TEST_DATA === 'true') {
      // `npm run dev:test`: 20 dummy students with connected batches, attendance and history
      assertSafeToSeed(env.USE_MEMORY_DB);
      console.log('🌱 Dummy test data:', await seedTestData());
    } else if (env.USE_MEMORY_DB) {
      await seedTracking();
    }

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 ScholarLogic Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`📡 API Base URL: http://localhost:${env.PORT}/api`);
      // Pull new Google Form responses in the background (needs GOOGLE_FORM_SYNC_URL)
      startAutoSync();
      // Read users and punches from the eSSL machine (needs ESSL_DEVICE_HOST)
      startMachinePull();
    });

    const gracefulShutdown = () => {
      console.log(' shutting down server...');
      server.close(() => {
        console.log('Server process terminated');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('❌ Failed to start ScholarLogic server:', error);
    process.exit(1);
  }
}

startServer();
