import { test, expect, Page } from '@playwright/test';

const COURSE_TITLE = 'Python Full Stack Development';

async function login(page: Page, email: string, password: string, landing: RegExp) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(landing);
}

async function openZohoForm(page: Page) {
  await page.goto('/trainer/content');
  await expect(page.locator('h1')).toContainText('Course Content Management');
  await page.getByRole('button', { name: /\+ Upload Video/ }).click();
  await page.getByRole('button', { name: 'Zoho Meeting' }).click();
  return page.locator('form').filter({ hasText: 'Zoho Meeting Recording URL' });
}

test.describe('Zoho Meeting Recording Link E2E Flow', () => {
  test('trainer adds a Zoho recording link and the student can open it', async ({ page, browser }, testInfo) => {
    // Unique per run so the lesson is easy to find
    const recordingId = `e2e_rec_${Date.now()}`;
    const zohoUrl = `https://meeting.zoho.in/meeting/public/videoprv?recordingId=${recordingId}&x-meeting-org=60012345`;
    const lessonTitle = `Live Session Recording ${recordingId}`;

    // --- Trainer side: paste, validate and add the Zoho link ---
    await login(page, 'trainer@scholarlogic.edu', 'Trainer@123', /\/trainer\/dashboard/);
    const form = await openZohoForm(page);

    const courseSelect = form.locator('select').first();
    await courseSelect.selectOption({ label: COURSE_TITLE });
    const courseId = await courseSelect.inputValue();
    // Module list reloads for the chosen course
    await expect(form.locator('select').nth(1).locator('option').first()).toContainText('Module 1');

    await form.getByPlaceholder('Write lesson title here (e.g. Session 1 Live Recording)...').fill(lessonTitle);
    await form.getByPlaceholder(/meeting\.zoho\.in/).fill(zohoUrl);

    await form.getByRole('button', { name: 'Validate' }).click();
    await expect(form.getByText('Valid Zoho Meeting Recording')).toBeVisible();
    await expect(form.getByText(recordingId)).toBeVisible();
    await expect(form.getByText('60012345')).toBeVisible();

    await form.getByRole('button', { name: 'Add Recording' }).click();
    await expect(page.getByText('Zoho Meeting Recording associated successfully with Lesson!')).toBeVisible();

    // Shows up in the trainer's Videos tab, pointing at the Zoho link
    await page.getByRole('button', { name: '🎥 Videos' }).click();
    const trainerRow = page.locator('tr', { hasText: lessonTitle });
    await expect(trainerRow).toBeVisible();
    await expect(trainerRow.getByRole('link', { name: 'Preview' })).toHaveAttribute('href', zohoUrl);

    // --- Student side: lesson appears and opens the Zoho recording ---
    const studentContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    const studentPage = await studentContext.newPage();
    await login(studentPage, 'student@scholarlogic.edu', 'Student@123', /\/student\/dashboard/);

    await studentPage.goto(`/student/courses/${courseId}`);
    await studentPage.getByRole('button', { name: new RegExp(lessonTitle) }).click();
    await expect(studentPage.locator('h2', { hasText: lessonTitle })).toBeVisible();

    const watchLink = studentPage.getByRole('link', { name: /Watch Zoho Recording/ });
    await expect(watchLink).toBeVisible();
    await expect(watchLink).toHaveAttribute('href', zohoUrl);
    await expect(watchLink).toHaveAttribute('target', '_blank');
    await expect(studentPage.getByText(`Recording ID: ${recordingId}`)).toBeVisible();

    // Must not try to play the Zoho page as a raw video file
    await expect(studentPage.locator('video')).toHaveCount(0);

    await studentContext.close();
  });

  test('trainer sees an error for links that are not Zoho Meeting recordings', async ({ page }) => {
    await login(page, 'trainer@scholarlogic.edu', 'Trainer@123', /\/trainer\/dashboard/);
    const form = await openZohoForm(page);
    const urlInput = form.getByPlaceholder(/meeting\.zoho\.in/);
    const validate = form.getByRole('button', { name: 'Validate' });

    const badLinks: Array<[string, RegExp]> = [
      ['https://www.youtube.com/watch?v=abc123', /not an authorized Zoho Meeting domain/],
      ['https://meeting.zoho.in.evil.com/videoprv?recordingId=abc123', /not an authorized Zoho Meeting domain/],
      ['https://meeting.zoho.in/', /Unable to extract valid recording ID/],
    ];

    for (const [url, expectedError] of badLinks) {
      await urlInput.fill(url);
      await validate.click();
      await expect(form.getByText(expectedError)).toBeVisible();
      await expect(form.getByText('Valid Zoho Meeting Recording')).toHaveCount(0);
    }
  });
});
