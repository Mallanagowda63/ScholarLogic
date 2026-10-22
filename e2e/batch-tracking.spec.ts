import { test, expect, Page } from '@playwright/test';

// Acceptance flow for the Student + Batch + Trainer tracking MVP.
// Relies on the in-memory seed: Data Analytics course, Python (20 topics), PY-B01 (7-8 AM) and PY-B02 (10-11 AM)
// both taught by the demo trainer.

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', identifier);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(landing, { timeout: 20000 });
}

test('admin allocates, trainer updates, admin reallocates, student sees new batch', async ({ browser }) => {
  test.setTimeout(120_000);
  const studentId = `DA-${String(Date.now()).slice(-6)}`;

  // 1-4. Admincreates Mohit (no email) in Data Analytics and allocates PY-B01
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, 'admin@scholarlogic.edu', 'Admin@123', /\/admin\//);
  await admin.goto('/admin/students');
  await admin.getByRole('button', { name: 'New Student' }).click();
  const form = admin.getByRole('dialog');
  await form.getByLabel('Name').fill('Mohit');
  await form.getByLabel('Phone').fill('9876500001');
  await form.getByLabel('Course').selectOption({ label: 'Data Analytics' });
  await form.getByLabel('Preferred timing').fill('7-8 AM');
  await form.getByPlaceholder('e.g. MOHIT-DA-01').fill(studentId);
  await form.getByLabel('Initial password').fill('Mohit@123');
  await form.getByRole('button', { name: 'Create student' }).click();

  // Creating a student opens the journey page with the allocation dialog ready
  const allocate = admin.getByRole('dialog', { name: /Allocate batch/ });
  await expect(allocate).toBeVisible();
  await allocate.getByRole('button', { name: /PY-B01/ }).click();
  await allocate.getByRole('button', { name: 'Allocate Student' }).click();
  await expect(admin.getByText('Current batch').locator('..').getByText('PY-B01')).toBeVisible();
  const journeyUrl = admin.url();

  // 5-8. Trainer sees Mohit in PY-B01, marks attendance and completes 8 topics
  const trainerCtx = await browser.newContext();
  const trainer = await trainerCtx.newPage();
  await login(trainer, 'trainer@scholarlogic.edu', 'Trainer@123', /\/trainer\//);
  await trainer.goto('/trainer/batches');
  await trainer.getByText('PY-B01').first().click();
  await expect(trainer.getByRole('cell', { name: studentId })).toBeVisible();
  const topicBoxes = trainer.locator('form input[type="checkbox"]');
  for (let i = 0; i < 8; i++) await topicBoxes.nth(i).check();
  await trainer.getByLabel('Topic taught').fill('Python basics');
  await trainer.getByRole('button', { name: 'Save class update' }).click();
  await expect(trainer.getByText('Class update saved')).toBeVisible();

  // 9-10. Admin sees 40% Python progress and PY-B01 in history
  await admin.goto(journeyUrl);
  await expect(admin.getByText('8 / 20 topics • 40%')).toBeVisible();
  await expect(admin.getByText('1 / 1 classes • 100%')).toBeVisible();

  // 11-14. Mark PY-B01 missed and reallocate to PY-B02; old allocation stays in history
  await admin.getByRole('button', { name: 'Reallocate', exact: true }).click();
  const realloc = admin.getByRole('dialog', { name: /Reallocate batch/ });
  await realloc.getByLabel(/Mark PY-B01 as/).selectOption('MISSED');
  await realloc.getByRole('button', { name: /PY-B02/ }).click();
  await realloc.getByLabel('Reason').fill('Student unavailable at 7 AM');
  await realloc.getByRole('button', { name: 'Reallocate Student' }).click();
  await expect(admin.getByText('Current batch').locator('..').getByText('PY-B02')).toBeVisible();
  const oldCard = admin.locator('div.rounded-xl', { has: admin.getByRole('link', { name: 'PY-B01' }) }).first();
  await expect(oldCard.getByText('Missed')).toBeVisible();
  await expect(admin.getByText('8 / 20 topics • 40%')).toBeVisible(); // progress preserved

  await admin.getByRole('button', { name: /^History/ }).click();
  await expect(admin.getByText('Reallocated PY-B01 → PY-B02')).toBeVisible();

  // 16. PY-B02 roster shows Mohit
  await admin.goto('/admin/batches');
  await admin.getByRole('link', { name: 'PY-B02' }).click();
  await expect(admin.getByRole('cell', { name: studentId })).toBeVisible();

  // 15. Student logs in with Student ID (no email) and sees PY-B02
  const studentCtx = await browser.newContext();
  const student = await studentCtx.newPage();
  await login(student, studentId, 'Mohit@123', /\/student\/dashboard/);
  const journeyCard = student.locator('section', { hasText: 'My Course Journey' });
  await expect(journeyCard).toBeVisible();
  await expect(journeyCard.getByText('PY-B02')).toBeVisible();
  await expect(journeyCard.getByText('Re-Attending').first()).toBeVisible();

  await Promise.all([adminCtx.close(), trainerCtx.close(), studentCtx.close()]);
});
