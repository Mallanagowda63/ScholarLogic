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
