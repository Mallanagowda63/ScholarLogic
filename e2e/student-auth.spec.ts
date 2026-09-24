import { test, expect } from '@playwright/test';

test.describe('Student Authentication & Dashboard E2E Flow', () => {
  test('should login successfully as Student and access dashboard', async ({ page }) => {
    await page.goto('/login');

    // Fill credentials
    await page.fill('input[type="email"]', 'student@scholarlogic.edu');
    await page.fill('input[type="password"]', 'Student@123');

    // Click Login Button
    await page.click('button[type="submit"]');

    // Verify redirected to student dashboard
    await expect(page).toHaveURL(/\/student\/dashboard/);
    await expect(page.locator('h1')).toContainText(/Welcome back/i);
  });

  test('should display error message on invalid login credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'student@scholarlogic.edu');
    await page.fill('input[type="password"]', 'WrongPassword123');

    await page.click('button[type="submit"]');

    await expect(page.locator('body')).toContainText(/Incorrect|Invalid|Error|failed/i);
  });
});
