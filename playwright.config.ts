import { defineConfig, devices } from '@playwright/test';

// E2E tests run against their own backend + frontend on separate ports, backed by a
// fresh in-memory MongoDB (auto-seeded on startup). This keeps test runs from writing
// exam attempts/results into the real Atlas database, and leaves the regular dev
// servers on 5000/5173 free to keep running.
const TEST_API_PORT = 5101;
const TEST_WEB_PORT = 5190;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${TEST_WEB_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Exam runner asks for camera access; use Chromium's fake device instead of a prompt
    permissions: ['camera', 'microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: './backend',
      port: TEST_API_PORT,
      reuseExistingServer: false,
      // First run may download the MongoMemoryServer binary
      timeout: 180_000,
      env: {
        PORT: String(TEST_API_PORT),
        USE_MEMORY_DB: 'true',
        FRONTEND_URL: `http://localhost:${TEST_WEB_PORT}`,
      },
    },
    {
      command: `npx vite --port ${TEST_WEB_PORT} --strictPort`,
      cwd: './frontend',
      port: TEST_WEB_PORT,
      reuseExistingServer: false,
      env: {
        VITE_PROXY_TARGET: `http://localhost:${TEST_API_PORT}`,
      },
    },
  ],
});
