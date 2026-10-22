import { test, expect, Page, APIRequestContext } from '@playwright/test';

// eSSL flow through the admin UI: student → E Number → card → push → machine confirmation → punches → attendance.
// The "machine" is this test speaking ADMS to the test backend (in-memory DB), so this proves ScholarLogic's
// side only. It says nothing about the real S990.
const API = 'http://localhost:5101';
const SN = 'CUB7254300566';

async function login(page: Page, identifier: string, password: string, landing: RegExp) {
  await page.goto('/login');
  await page.fill('input[autocomplete="username"]', identifier);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(landing, { timeout: 20000 });
}

const machine = (request: APIRequestContext) => {
  const text = { 'Content-Type': 'text/plain' };
  return {
    handshake: () => request.get(`${API}/iclock/cdata?SN=${SN}&options=all&pushver=2.4.1`),
    poll: async () => (await request.get(`${API}/iclock/getrequest?SN=${SN}`)).text(),
    reply: (body: string) => request.post(`${API}/iclock/devicecmd?SN=${SN}`, { headers: text, data: body }),
    users: (body: string) => request.post(`${API}/iclock/cdata?SN=${SN}&table=OPERLOG&Stamp=1`, { headers: text, data: body }),
    punches: (body: string) => request.post(`${API}/iclock/cdata?SN=${SN}&table=ATTLOG&Stamp=${Date.now()}`, { headers: text, data: body }),
  };
};

test('student gets an E Number and card, is pushed to the machine, and card punches become attendance', async ({ page, request }) => {
  test.setTimeout(120_000);
  const tag = String(Date.now()).slice(-6);
  const name = `Riya Essl${tag}`;
  const card = `77${tag}`;
  const device = machine(request);
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); // IST

  // Admin creates the student; the E Number is assigned automatically
  await login(page, 'admin@scholarlogic.edu', 'Admin@123', /\/admin\//);
  await page.goto('/admin/students');
  await page.getByRole('button', { name: 'New Student' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Name').fill(name);
  await form.getByLabel('Phone').fill(`98${tag}11`);
  await form.getByLabel('Course').selectOption({ label: 'Data Analytics' });
  await form.getByLabel('Initial password').fill('Riya@12345');
  await form.getByRole('button', { name: 'Create student' }).click();
  await expect(page.getByRole('dialog', { name: /Allocate batch/ })).toBeVisible();

  await page.goto('/admin/essl');
  await expect(page.getByText('The machine has never connected to ScholarLogic')).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(name) });
  const eNumber = (await row.getByRole('cell').nth(2).innerText()).trim();
  expect(eNumber).toMatch(/^[1-9]\d*$/);
  await expect(row.getByText('Not pushed', { exact: true })).toBeVisible();

  // Link the card to that E Number
  await row.getByLabel(`Card Number for ${name}`).fill(card);
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText(`Card ${card} linked`);

  // Push: queued, and plainly reported as not delivered while the machine has never connected
  await row.getByLabel(`Select ${name}`).check();
  await page.getByRole('button', { name: /Push 1 to machine/ }).click();
  const results = page.getByRole('dialog', { name: 'Push results' });
  await expect(results.getByText('The machine has never connected: nothing below has reached it.')).toBeVisible();
  await expect(results.getByRole('row', { name: new RegExp(name) })).toContainText('Queued');
  await results.getByRole('button', { name: 'Close' }).click();
  await expect(row.getByText('Queued', { exact: true })).toBeVisible();

  // The machine connects, collects the command and accepts it
  await device.handshake();
  const command = (await device.poll()).split('\n').find((l) => l.includes(`PIN=${eNumber}\t`))!;
  expect(command).toContain(`DATA UPDATE USERINFO PIN=${eNumber}\tName=${name}\tCard=${card}`);
  await device.reply(`ID=${command.split(':')[1]}&Return=0&CMD=DATA`);
  await page.getByTitle('Refresh').click();
  await expect(row.getByText('Accepted by machine')).toBeVisible();

  // Only the machine's own record of the user makes it "Verified"
  await device.users(`USER PIN=${eNumber}\tName=${name}\tPri=0\tPasswd=\tCard=${card}\tGrp=1`);
  await page.getByTitle('Refresh').click();
  await expect(row.getByText('Verified on machine')).toBeVisible();
  await expect(page.getByText('Machine online')).toBeVisible();

  // Card punches (verify mode 4): IN and OUT for the student, plus one from an ID nobody has
  await device.punches([`${eNumber}\t${today} 09:05:00\t0\t4\t0\t0`, `${eNumber}\t${today} 17:10:00\t1\t4\t0\t0`, `990${tag}\t${today} 09:06:00\t0\t4\t0\t0`].join('\n'));

  await page.goto('/admin/biometric');
  const live = page.getByRole('row', { name: new RegExp(name) });
  await expect(live).toContainText('9:05 AM');
  await expect(live).toContainText('5:10 PM');
  await expect(live).toContainText('Present');

  // The unknown ID is held for review, not attached to anyone
  await page.goto('/admin/essl');
  await page.getByRole('button', { name: /Review queue/ }).click();
  await expect(page.getByRole('cell', { name: `990${tag}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Sync log' }).click();
  await expect(page.getByText(new RegExp(`Machine accepted ID ${eNumber} `))).toBeVisible();
  await expect(page.getByText(/3 punch\(es\) received: 3 new/)).toBeVisible();

  // Master sheet: preview flags the duplicate and the unknown name, and keeps the valid row
  await page.getByRole('button', { name: 'Import / export' }).click();
  const csv = [
    'E Number,Name,Company,Department,Designation,Apply Type',
    `${eNumber},${name},ScholarLogic,Data Analytics,Student,Regular`,
    `880${tag},Nobody ${tag},ScholarLogic,Data Analytics,Student,Regular`,
    `881${tag},Dup One,ScholarLogic,Data Analytics,Student,Regular`,
    `881${tag},Dup Two,ScholarLogic,Data Analytics,Student,Regular`,
  ].join('\n');
  await page.locator('input[type="file"]').setInputFiles({ name: 'essl-master.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('1 to update')).toBeVisible();
  await expect(page.getByText('2 with errors')).toBeVisible();
  await expect(page.getByText(`E Number 881${tag} appears 2 times in the file`).first()).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 row' }).click();
  await expect(page.getByText(/Import finished: 1 applied, 0 unchanged, 1 skipped, 2 invalid, 0 failed/)).toBeVisible();
});
