# SCHOLARLOGIC Architecture Document

## System Overview
ScholarLogic is built around a single central identity hub where all educational, assessment, resume engineering, and corporate placement modules communicate through a unified student profile entity.

```
                  +-----------------------------------+
                  |   ScholarLogic Public / Student UI |
                  +-----------------+-----------------+
                                    |
                         REST API (JWT Auth)
                                    v
                  +-----------------+-----------------+
                  |   Node.js / Express API Server    |
                  |     (TypeScript Architecture)     |
                  +----+--------+--------+-------+----+
                       |        |        |       |
      +----------------+        |        |       +---------------+
      v                         v        v                       v
+-----+-------+          +------+---+ +--+--------+     +--------+------+
| Mongoose DB |          | LMS      | | Exam      |     | AI ATS Engine |
| 20+ Models  |          | Engine   | | Evaluator |     | Heuristic/LLM |
+-------------+          +----------+ +-----------+     +---------------+
```

## Central Identity Flow
1. **User Registration** -> Trigger `getNextStudentId()` -> Counter increments -> Generates `SL-2026-XXXXX`.
2. **Central Auth** -> Issues JWT Access Token (1d) + Refresh Token (7d).
3. **Student Profile** -> Stores academic, skill, and portfolio attributes consumed by LMS, Exams, Resume AI, and Placement Matching.
