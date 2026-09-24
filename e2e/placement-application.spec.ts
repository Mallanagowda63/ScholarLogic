import { test, expect } from '@playwright/test';

test.describe('Placement Portal & Job Application E2E Flow', () => {
  test('should allow student to browse jobs and view applications', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@scholarlogic.edu');
    await page.fill('input[type="password"]', 'Student@123');
    await page.click('button[type="submit"]');

    // Wait for login redirection
    await expect(page).toHaveURL(/\/student\/dashboard/);

    // Go to jobs via Navbar link
    await page.click('a[href="/student/jobs"]');
    await page.waitForURL(/\/student\/jobs/);
    await expect(page.locator('h1')).toContainText(/Placement|Jobs/i);

    // Go to applications via Navbar link
    await page.click('a[href="/student/applications"]');
    await page.waitForURL(/\/student\/applications/);
    await expect(page.locator('h1')).toContainText(/Applications/i);

    // The seeded application must actually load (catches API errors that leave the list empty)
    await expect(page.locator('h3', { hasText: 'Python Full Stack Engineer' })).toBeVisible();
  });
});
