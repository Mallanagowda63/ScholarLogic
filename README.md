# SCHOLARLOGIC — Career & Learning Hub

SCHOLARLOGIC is a production-quality, full-stack EdTech and CareerTech platform ("ScholarLogic Career & Learning Hub"). It seamlessly connects Learning Management (LMS), Online Examinations, AI ATS Resume Analysis & Generation, Placement Drives, and Role-Based Management through a single, central ScholarLogic Student ID system.

---

## 🔑 Demo User Credentials

The system includes a zero-config seed script that initializes all roles with pre-configured demo data:

| Role | Email | Password | Student ID / Details |
| :--- | :--- | :--- | :--- |
| **Student** | `student@scholarlogic.edu` | `Student@123` | `SL-2026-00001` (Alex Morgan) |
| **Admin** | `admin@scholarlogic.edu` | `Admin@123` | Master System Administrator |
| **Trainer** | `trainer@scholarlogic.edu` | `Trainer@123` | Lead Course Instructor |
| **Placement Manager** | `placement@scholarlogic.edu` | `Placement@123` | Placement Drive Director |

---

## 🚀 Quick Start Guide

### Prerequisites
* Node.js v18+ and npm installed.
* Local MongoDB OR zero-config auto fallback via `MongoMemoryServer` (Included out of the box).

### 1. Clone & Setup Backend
```bash
cd backend
npm install
npm run seed     # Seeds initial 4 courses, users, exams, companies, and jobs
npm run dev      # Starts Express API server on http://localhost:5000
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev      # Starts Vite dev server on http://localhost:5173
```

---

## 🛠 Stack Architecture

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React, React Router DOM v7.
* **Backend**: Node.js, Express.js (TypeScript), JWT Access + Refresh Tokens, Zod, Multer.
* **Database**: MongoDB (Mongoose ORM) with 20+ strictly indexed collections & atomic Student ID sequence counter.
* **AI Engine**: `AIService` abstraction supporting Gemini/OpenAI API + heuristic NLP fallback analyzer.
* **Testing**: Vitest integration test suite covering Auth, Student ID, LMS, Exams, ATS Engine, and Placement workflow.

---

## 📚 Key Features & Modules

1. **Central Auth & Student ID**: Single authentication system issuing unique permanent IDs (`SL-2026-XXXXX`).
2. **LMS Module**: Courses, Modules, Lessons, HTML5 Video player with database progress tracking (`video_progress`), PDF notes downloader, assignment submissions, and quizzes.
3. **Seeded Initial Courses**:
   - Python Full Stack Development
   - AWS / Cloud Architecture & Operations
   - DevOps Engineering & CI/CD Pipelines
   - Data Analytics & Power BI Mastery
4. **Online Exam Engine**: Live countdown timer, progressive answer auto-saving, question status palette, server-side grading, negative marking, and Recharts topic skill radar.
5. **AI Resume ATS Analyzer**: Upload/paste resumes + JDs, get overall ATS score %, missing skills, keyword recommendations, 4 templates (Classic, Modern, Technical, Minimal), versioning, and PDF export.
6. **Placement Portal**: Company & Job management, dynamic skill match % algorithm, application status flow (`APPLIED` -> `SHORTLISTED` -> `TECH_INTERVIEW` -> `OFFERED` -> `JOINED`), and interview scheduling.
7. **Certificate Verification**: Public verification portal at `/verify/:certificateId`.

---

## 🧪 Verification & Testing

To run the automated backend Vitest integration suite:
```bash
cd backend
npm test
```
To run production builds:
```bash
cd backend && npm run build
cd ../frontend && npm run build
```
