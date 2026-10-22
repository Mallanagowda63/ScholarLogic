# Google Form → ScholarLogic intake

The Google Form stays the student intake form. Every response flows automatically into
**Admin → New Registrations** as *Pending Verification / Waiting for Allocation*.

```
Google Form → Response Sheet → Apps Script (On form submit) → POST /api/integrations/google-form/student
→ GoogleFormSubmission (raw copy) → StudentRegistration (Pending) → Admin verifies → Student + Student ID
→ Admin allocates batch → normal ScholarLogic flow (trainer progress, attendance, history)
```

## 0. Two ways to connect — pick one (or both)

| | **Pull** (recommended while the backend runs on a laptop) | **Push** |
|---|---|---|
| Direction | ScholarLogic fetches from Google | Google sends to ScholarLogic |
| Needs a public backend URL | No | Yes (hosting or tunnel) |
| Speed | Every 5 min automatically, or instantly with **Sync from Google Form** | Seconds |

### Pull setup (5 minutes)

1. In the response spreadsheet's Apps Script, paste the latest [`Code.gs`](./Code.gs) (it contains `doPost`/`doGet`). Save.
2. Script Properties: `SCHOLARLOGIC_FORM_SECRET` = the backend's `GOOGLE_FORM_WEBHOOK_SECRET`.
3. **Deploy → New deployment → ⚙ Select type → Web app**
   - Description: `ScholarLogic sync`
   - Execute as: **Me**
   - Who has access: **Anyone** (the data is still protected by the secret)
   - **Deploy** → authorise → copy the **Web app URL** (ends in `/exec`).
4. Backend `.env`:
   ```
   GOOGLE_FORM_SYNC_URL=https://script.google.com/macros/s/…/exec
   GOOGLE_FORM_SYNC_INTERVAL_MINUTES=5
   ```
   Restart the backend. Opening the URL in a browser shows "ScholarLogic form sync is running".
5. Admin → **New Registrations → Sync from Google Form**. New responses are imported; ones already imported are skipped.

After editing `Code.gs` later, use **Deploy → Manage deployments → ✏ → Version: New version → Deploy** so the URL stays the same.

## 1. Backend (push)

Add to `backend/.env` (never in frontend code):

```
GOOGLE_FORM_WEBHOOK_SECRET=<long random value, e.g. 48+ characters>
```

Generate one with: `node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"`

The endpoint returns `503` until this is set, and `401` for a wrong or missing secret.

Apps Script runs on Google's servers, so the backend must be reachable over **HTTPS on the internet**:

- Production / staging: `https://<your-api-domain>/api/integrations/google-form/student`
- Local testing: expose port 5000 with a tunnel, e.g. `cloudflared tunnel --url http://localhost:5000`
  (or `ngrok http 5000`) and use `https://<tunnel-host>/api/integrations/google-form/student`.
  Tunnel URLs change on restart — update the script property when they do.

## 2. Tidy the form (recommended)

The live form works as-is, but two questions are both titled **Course**:

| Question now | Change to |
|---|---|
| Course (Online / Other) | **Mode** — options **Online**, **Offline** |
| Course (Data Analytics / Cloud Computing / Python Full Stack) | keep as **Course** |
| Preferred Timing (time picker) | delete (the dropdown below is clearer) |
| Preferred Time (dropdown) | rename to **Preferred Timing** |

Optionally add **Comments / Special Requirements** (paragraph).
The backend maps answers by title *and* by value, so it copes with the current layout too.

## 3. Link the form to a sheet

Form → **Responses** tab → **Link to Sheets** → create a new spreadsheet (or pick the existing one).

## 4. Add the script

1. Open the response spreadsheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with the contents of [`Code.gs`](./Code.gs). Save.
3. **Project Settings (⚙) → Script Properties → Add property**:
   - `SCHOLARLOGIC_API_URL` = full endpoint URL from step 1
   - `SCHOLARLOGIC_FORM_SECRET` = the same value as `GOOGLE_FORM_WEBHOOK_SECRET`
4. In the editor choose the function **`installTriggers`** → **Run** → approve the permissions
   (spreadsheet access, external requests, triggers).

5. Responses submitted **before** the script was installed: choose **`syncAllResponses`** → **Run** once.
   It imports every row not yet delivered (already-imported rows are skipped).

`installTriggers` creates:
- an installable **On form submit** trigger → `onFormSubmitToScholarLogic`
- a **15-minute** time trigger → `retryFailed` (resends anything that failed)

To do it by hand instead: **Triggers (⏰) → Add Trigger** → function `onFormSubmitToScholarLogic`,
event source **From spreadsheet**, event type **On form submit**.

## 5. What gets logged

A tab named **ScholarLogic Sync** records each response row: status (`SENT`, `FAILED`,
`STORED_NEEDS_REVIEW`), HTTP code, message and attempt count. The secret is never logged.

- `FAILED` — backend unreachable or rejected the request. The answers remain in the sheet; `retryFailed` resends them.
- `STORED_NEEDS_REVIEW` — backend saved the raw response but couldn't process it (e.g. no name).
  It appears in **Admin → New Registrations → Failed submissions** with **Retry processing**.

Resending the same row is safe: each response has a stable `submissionId`, so the backend never duplicates it.

## 6. Duplicate handling

Phone numbers are normalised (`+91 98765 43210`, `91-9876543210`, `09876543210` → `9876543210`).

1. Matches an **existing student** (Student ID → phone → email): logged as `DUPLICATE`, linked to that student,
   only empty phone/address are filled. Batches, progress and history are never touched.
2. Matches a **pending/rejected registration** (phone → email): that registration is updated with the latest
   answers and its submission count goes up. No new row.
3. Otherwise a **new registration** is created.

## 7. End-to-end test

1. Submit the form with a phone number **not** already used by a student (note: the demo student uses 98765 43210).
2. Sheet: a new response row appears.
3. Apps Script → **Executions**: `onFormSubmitToScholarLogic` succeeded; **ScholarLogic Sync** shows `SENT`.
4. Admin → **New Registrations**: the student is listed as *Pending Verification* / *Waiting for Allocation*.
5. **Verify** → check details, assign course, keep the generated password → *Verify & create student*.
   A Student ID such as `DA-021` is generated and the student's page opens with **Allocate batch**.
6. Allocate the first batch. The student now appears on the normal **Students** page and can log in with
   Student ID + password.

Admins can still add students manually with **Students → New Student** if the integration is down.
