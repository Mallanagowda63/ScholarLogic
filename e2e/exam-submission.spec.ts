import { test, expect } from '@playwright/test';

// Correct answers for the seeded "Python Full Stack Assessment Exam", keyed by question text
// so the test still works if question randomization is enabled.
const CORRECT_ANSWERS: Record<string, string> = {
  'Which of the following data structures in Python is immutable?': 'Tuple',
  'In Object-Oriented Programming, what is method overriding?':
    'Re-implementing a method in a child class that is already defined in parent class',
  'What HTTP method is idempotent and used to replace an existing resource?': 'PUT',
  'Which SQL clause is used to filter records aggregated by a GROUP BY clause?': 'HAVING',
  'Is GIL (Global Interpreter Lock) in CPython thread-safe for CPU-bound multithreading?': 'False',
};

test.describe('Online Exam Runner & Proctoring E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@scholarlogic.edu');
    await page.fill('input[type="password"]', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test('should allow student to view exams list and navigate to instructions', async ({ page }) => {
    await page.click('a[href="/student/exams"]');
    await page.waitForURL(/\/student\/exams/);
    await expect(page.locator('h1')).toContainText(/Exams|Assessment/i);

    await page.getByRole('link', { name: /Start Secure Exam/ }).first().click();
    await page.waitForURL(/\/student\/exams\/[^/]+\/instructions/);
    await expect(page.locator('h1')).toContainText('Secure Exam Instructions');
    await expect(page.getByRole('button', { name: /Start Secure Exam Session/ })).toBeVisible();
  });

  test('should take the exam, submit it and show a passing result', async ({ page }) => {
    // Accept the "Are you sure you want to submit?" confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/student/exams');
    const examCard = page.locator('div.rounded-2xl', { hasText: 'Python Full Stack Assessment Exam' });
    await examCard.getByRole('link', { name: /Start Secure Exam/ }).click();
    await page.waitForURL(/\/instructions/);

    // Camera is required before the exam can start (Chromium's fake device grants it)
    await page.getByRole('button', { name: /Allow Camera Permission/ }).click();
    await expect(page.getByText('✓ GRANTED')).toBeVisible();

    await page.getByRole('button', { name: /Start Secure Exam Session/ }).click();
    await page.waitForURL(/\/runner/);
    await expect(page.getByText('Question 1 of 5')).toBeVisible();

    for (let i = 0; i < 5; i++) {
      const questionText = (await page.locator('main h3').innerText()).trim();
      const answer = CORRECT_ANSWERS[questionText];
      expect(answer, `No known answer for question: ${questionText}`).toBeDefined();

      await page.locator('main button', { hasText: answer }).click();
      await expect(page.getByText('✓ Auto-Saved')).toBeVisible();

      if (i < 4) await page.getByRole('button', { name: 'Next →' }).click();
    }

    await page.getByRole('button', { name: /Submit Exam/ }).click();

    await page.waitForURL(/\/student\/results\//);
    await expect(page.getByText('PASSED & CERTIFIED')).toBeVisible();
    await expect(page.getByText('100 / 100')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
  });
});
