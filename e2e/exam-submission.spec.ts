import { test, expect } from '@playwright/test';

test.describe('Online Exam Runner & Proctoring E2E Flow', () => {
  test('should allow student to view exams list and navigate to instructions', async ({ page }) => {
    // 1. Login as Student
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@scholarlogic.edu');
    await page.fill('input[type="password"]', 'Student@123');
    await page.click('button[type="submit"]');

    // Wait for login redirection
    await expect(page).toHaveURL(/\/student\/dashboard/);

    // 2. Navigate to Exams via Navbar link
    await page.click('a[href="/student/exams"]');
    await page.waitForURL(/\/student\/exams/);
    await expect(page.locator('h1')).toContainText(/Exams|Assessment/i);
  });
});
