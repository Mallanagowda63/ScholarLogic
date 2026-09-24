import { test, expect } from '@playwright/test';

// The backend asks a fixed set of 4 questions per session
const QUESTION_COUNT = 4;

test.describe('Voice AI Mock Interview E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'student@scholarlogic.edu');
    await page.fill('input[type="password"]', 'Student@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test('should answer every question and show the evaluation report', async ({ page }) => {
    // No sidebar link exists for this page yet, so open it directly
    await page.goto('/student/mock-interview');
    await expect(page.locator('h1')).toContainText('Voice AI Mock Interview Simulator');

    await page.locator('select').selectOption('Backend Developer');
    await page.getByRole('button', { name: 'HARD' }).click();
    await page.getByRole('button', { name: /Start Voice AI Interview Session/ }).click();

    // First question mentions the chosen role
    await expect(page.getByText('Current AI Question')).toBeVisible();
    await expect(page.getByText(/Tell me about yourself.*Backend Developer/).last()).toBeVisible();

    const answerBox = page.getByPlaceholder('Voice input text will appear here...');
    const submitAnswer = page.getByRole('button', { name: /Submit Answer & Proceed/ });

    // Submitting is blocked until there is an answer
    await expect(submitAnswer).toBeDisabled();

    for (let i = 1; i <= QUESTION_COUNT; i++) {
      const answer = `E2E answer number ${i}: I designed and tested a REST API with indexed queries.`;
      await answerBox.fill(answer);
      await submitAnswer.click();

      if (i < QUESTION_COUNT) {
        // Answer lands in the transcript and the box is cleared for the next question
        await expect(page.getByText(answer)).toBeVisible();
        await expect(answerBox).toHaveValue('');
      }
    }

    // After the last answer the session finishes automatically and shows the report card
    await expect(page.getByText('INTERVIEW EVALUATION COMPLETE')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Backend Developer Mock Interview' })).toBeVisible();
    await expect(page.getByText('Key Strengths Identified:')).toBeVisible();
    await expect(page.getByText('Areas for Improvement:')).toBeVisible();

    // Scores are shown as percentages
    for (const label of ['Technical Accuracy', 'Communication Clarity', 'Confidence Score']) {
      await expect(page.getByText(label).locator('xpath=following-sibling::span')).toHaveText(/^\d{1,3}%$/);
    }

    // Can go back and start another session
    await page.getByRole('button', { name: 'Start New Mock Interview' }).click();
    await expect(page.getByRole('button', { name: /Start Voice AI Interview Session/ })).toBeVisible();
  });
});
