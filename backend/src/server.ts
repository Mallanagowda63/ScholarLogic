import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { seedDatabase } from './scripts/seed';

async function startServer() {
  try {
    await connectDB();

    // Auto-seed initial demo data if database is empty
    await seedDatabase(false);

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 ScholarLogic Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`📡 API Base URL: http://localhost:${env.PORT}/api`);
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
