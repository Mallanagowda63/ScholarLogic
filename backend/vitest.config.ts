import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
    globals: true,
    environment: 'node',
    // Tests call seedDatabase(), which wipes and reseeds collections. Always run them against a
    // throwaway in-memory MongoDB, never the database configured in .env.
    env: {
      USE_MEMORY_DB: 'true',
      NODE_ENV: 'test',
      GOOGLE_FORM_WEBHOOK_SECRET: 'test-form-secret',
      GOOGLE_FORM_SYNC_URL: 'https://script.google.com/macros/s/test-deployment/exec',
      GOOGLE_FORM_SYNC_INTERVAL_MINUTES: '0',
      // The eSSL tests cover ScholarLogic-assigned E Numbers; production leaves this off
      BIOMETRIC_AUTO_ENUMBER: 'true',
      ESSL_DEVICE_HOST: '',
    },
  },
});
