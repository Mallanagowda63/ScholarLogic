# SCHOLARLOGIC API Reference

## Authentication
* `POST /api/auth/register` — Register student/user.
* `POST /api/auth/login` — Login user.
* `POST /api/auth/refresh` — Refresh access token.
* `GET /api/auth/me` — Fetch active profile.

## Student Profile & Dashboard
* `GET /api/students/dashboard` — Fetch dashboard metrics & Student ID.
* `PUT /api/students/me` — Update academic & career profile.
* `GET /api/students` — Admin student directory.

## LMS Module
* `GET /api/courses` — List courses.
* `GET /api/courses/:id` — Course hierarchy & video progress.
* `POST /api/courses/progress` — Save video progress %.
* `POST /api/courses/assignments/:id/submit` — Submit assignment.
* `POST /api/courses/quizzes/:id/submit` — Evaluate quiz.

## Assessment Exam Engine
* `GET /api/exams` — List published exams.
* `POST /api/exams/:id/start` — Start timed exam attempt.
* `POST /api/exams/attempts/:attemptId/save` — Progressive answer save.
* `POST /api/exams/attempts/:attemptId/submit` — Server-side evaluation & topic breakdown.
* `GET /api/exams/results/me` — Fetch student exam history.

## AI Resume & ATS Engine
* `POST /api/resumes/analyze` — Run ATS analysis against JD.
* `POST /api/resumes/generate` — Save structured resume template.
* `GET /api/resumes` — List saved versions.

## Placement Portal
* `GET /api/placements/jobs` — List jobs with dynamic match %.
* `POST /api/placements/jobs/:id/apply` — Submit application.
* `GET /api/placements/applications` — Track application status pipeline.
* `POST /api/placements/interviews` — Schedule candidate interview.
* `POST /api/placements/offers` — Issue offer letter.

## Certificate Verification
* `GET /api/certificates/verify/:certificateId` — Public verification endpoint (No Auth Required).

## Attendance (Biometric + Manual)
* `GET /api/attendance/me?from=YYYY-MM-DD&to=YYYY-MM-DD` — Logged-in student's daily attendance calendar (Overall + per-subject tabs).
* `GET /api/attendance/students/:id` — Same calendar for a student (Admin/Trainer/Placement).
* `GET /api/attendance/biometric/live?date=YYYY-MM-DD` — Live monitor: device online/offline, per-student IN/OUT for the day, punch feed, unknown machine IDs (Admin/Trainer).
* `PUT /api/attendance/students/:id/biometric-id` — Body `{ biometricId }`: set/clear the ID the student is enrolled under on the machine; that ID's punches move to the student (Admin).

### eSSL S990 device push (ADMS)
The machine pushes punches to `/iclock/*` (outside `/api`, plain-text protocol). On the device: **Comm → Cloud Server Setting**
* Server mode `ADMS`, Server address = the ScholarLogic backend's public host/IP, Server port = its port (80/443 behind nginx, or 5000).
* The device can push to only one server: pointing it at ScholarLogic stops eSSL Web from receiving live punches.
* Only serials listed in `BIOMETRIC_DEVICE_SERIALS` are accepted (currently `CUB7254300566`).

Rules: punches between `BIOMETRIC_SHIFT_START`–`BIOMETRIC_SHIFT_END` (07:00–20:00 IST) count. IN followed by OUT = **Present**; IN only = **Incomplete** until the OUT arrives. If the device sends every punch with the same state key, the first punch of the day is IN and the last (≥1 min later) is OUT. Days count as absent for offline students only when the campus machine recorded someone that day (holidays are skipped automatically); Sundays are week-offs. Online students keep trainer-marked attendance.

Set `BIOMETRIC_PAIR_SINGLE_STATE=false` to turn off the same-state-key pairing, so that only a punch sent as IN followed by one sent as OUT counts as Present.

Matching a device PIN to a student: only the student's **Biometric ID** (their E Number), compared exactly. Nothing is inferred from Student IDs or names. Unknown IDs, and IDs whose card on the machine is registered to a different student, are stored unlinked and listed in the review queue. Punches outside the window are stored and listed there too.

### eSSL integration (Admin → eSSL Integration)
* **E Number** = `Student.biometricId`, separate from `studentId`. New students get the next number from an atomic counter (`counters.essl_e_number`); a unique index backs it. Numbers already assigned are never replaced, and the counter never goes back. It also skips numbers already seen on the machine. `BIOMETRIC_ENUMBER_START` sets the first number when no student has one.
* **Card Number** = `Student.cardNumber` (digits, leading zeros dropped, unique), linked to the same student as the E Number.
* `GET /api/attendance/biometric/overview` — Device sync status (online, last successful sync, last error, pending commands), every student's E Number, card and machine status.
* `POST /api/attendance/biometric/e-numbers/assign` — Body `{ studentIds? }`: assign E Numbers to those (or all) students without one.
* `PUT /api/attendance/students/:id/card-number` — Body `{ cardNumber }`: set/clear the card.
* `POST /api/attendance/biometric/import/preview` and `/import/commit` — multipart `file` (.xlsx/.xls/.csv) with columns E Number, Name, Company, Department, Designation, Apply Type (optional Card Number, Student ID). Preview returns per-row action, errors and warnings and saves nothing; commit validates again and returns per-row results. Re-importing the same file changes nothing.
* `GET /api/attendance/biometric/export?format=xlsx|xls|csv` — Master sheet for students with an E Number, in the header layout of the last imported eSSL file.
* `PUT /api/attendance/biometric/settings` — Body `{ defaults: { company, department, designation, applyType }, applyTypeAllowed: [] }`.
* `POST /api/attendance/biometric/push` — Body `{ studentIds, force? }`: queue the students for the machine. Per-student outcome is `QUEUED`, `ALREADY_QUEUED`, `AWAITING_DEVICE` or `NOT_QUEUED`; queueing is not delivery.
* `GET /api/attendance/biometric/review`, `POST /api/attendance/biometric/review/rematch`, `GET /api/attendance/biometric/logs?level=`.

Pushing uses the same ADMS channel: the queued command (`BIOMETRIC_USER_COMMAND`, default `DATA UPDATE USERINFO PIN=..\tName=..\tCard=..`) is handed to the machine when it polls `/iclock/getrequest`, and the machine's reply on `/iclock/devicecmd` (`Return=0` or an error code) sets the result. ScholarLogic then asks the machine for the stored record (`DATA QUERY USERINFO`); a student shows **Verified on machine** only once the machine's own record matches. Machine status values: `NOT_PUSHED`, `QUEUED`, `SENT`, `FAILED`, `CONFIRMED`, `VERIFIED`, `CARD_MISMATCH`. Unanswered commands are offered again every 2 minutes, up to 5 times, then marked failed.

Not yet verified against the real S990: the machine has not connected to ScholarLogic, so the user command variant, the card format it reports, and its IN/OUT state codes are untested on the device.
