# ClassBridge

Backend: Python / FastAPI (this `backend/` folder). Frontend: React + TanStack Start (the repository root).

> Different languages. Different learning speeds. One inclusive classroom.

Backend: FastAPI + SQLAlchemy (SQLite locally, Supabase Postgres in production) + Gemini or OpenAI.

```
Student questions (en / hi / fr) ──► AI answer in student's language  (+ English translation stored)
                │
                ▼
Cross-Language Misconception Radar  ──► teacher reviews clusters + supporting questions
                │  teacher approves an intervention
                ▼
AI mini-lesson on a predefined template (pizza / bars / number line), text in all 3 languages
                │
                ▼
Pre/post understanding check ──► teacher sees % correct and improvement
```

## Run it

You need two terminals: one for the backend (Python) and one for the frontend (website).

**Terminal 1 — backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # add GEMINI_API_KEY (or OPENAI_API_KEY + AI_PROVIDER=openai)
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend** (needs Node.js 20+), from the repository root:
```bash
npx bun install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npx bun run dev
```
Open the address it prints (e.g. http://localhost:8080). Teacher pages are under `/teacher`,
students join at `/join`. Each browser tab can be a different student, so you can demo several
students from one laptop. Leave `VITE_API_URL` empty to run the built-in sample classroom with no backend.

- Interactive API docs: http://localhost:8000/docs
- Backend tests (offline, mock AI): `pytest`
- Rehearse the whole demo from the command line with real AI: `python scripts/demo.py`

**Supabase:** set `DATABASE_URL` to the project's Postgres connection string. Tables are created
automatically on startup.

**Deploy:** backend on any Python host (Render, Railway, Fly.io) with start command
`uvicorn app.main:app --host 0.0.0.0 --port $PORT` and the same env vars. Frontend on Vercel/Lovable
with `VITE_API_URL` set to the backend's URL.

## Auth (hackathon-simple)

| Who | How |
|---|---|
| Teacher | `POST /api/classrooms` returns `teacher_token`. Send it as `X-Teacher-Token` header. |
| Student | `POST /api/join/{code}` returns `student_token`. Send it as `X-Student-Token` header. |

Store tokens in `localStorage`. Teachers never see which student asked a question.

## API contract

All bodies are JSON. Full schemas are at `/docs`.

### Teacher
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/classrooms` | `{title, topic?, lesson_notes?, lesson_language?}` | `{id, code, title, teacher_token}` |
| GET | `/api/teacher/classrooms/{id}` | | classroom |
| PUT | `/api/teacher/classrooms/{id}/lesson` | `{lesson_notes, topic?, lesson_language?}` | classroom (clears translation cache) |
| GET | `/api/teacher/classrooms/{id}/questions` | | `[{id, text, language, english_translation, concept, created_at}]` |
| POST | `/api/teacher/classrooms/{id}/analyze` | | `{analyzed_question_count, misconceptions[], unclustered_question_ids}` |
| GET | `/api/teacher/classrooms/{id}/misconceptions` | | `misconceptions[]` |
| POST | `/api/teacher/classrooms/{id}/misconceptions/{mid}/approve` | `{intervention_index}` | draft activity (all languages + answer key) |
| POST | `/api/teacher/classrooms/{id}/misconceptions/{mid}/dismiss` | | misconception |
| GET | `/api/teacher/classrooms/{id}/activities` | | `activities[]` |
| POST | `/api/teacher/classrooms/{id}/activities/{aid}/share` | | activity (students can now see it) |
| POST | `/api/teacher/classrooms/{id}/activities/{aid}/close` | | activity |
| GET | `/api/teacher/classrooms/{id}/activities/{aid}/results` | | `{pre, post, improvement_points, needs_more_support, student_count}` |
| GET | `/api/teacher/classrooms/{id}/dashboard` | | everything above in one call (poll every 3–5 s) |

A misconception looks like:
```json
{
  "id": 1,
  "title": "Larger denominator means larger fraction",
  "description": "Students treat the denominator like a whole number...",
  "teacher_insight": "Multiple students appear to be struggling with the relationship between denominator size and fraction value.",
  "confidence": 0.9,
  "status": "pending",
  "languages": ["en", "fr", "hi"],
  "supporting_questions": [{"id": 2, "text": "बड़ा हर होने पर...", "language": "hi", "english_translation": "Why does a fraction get smaller when the denominator is bigger?", "concept": "...", "created_at": "..."}],
  "interventions": [{"title": "Pizza-slicing visualization", "description": "...", "template": "fraction_pizza", "rationale": "..."}]
}
```

### Student
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/join/{code}` | | `{code, title, topic, languages}` |
| POST | `/api/join/{code}` | `{language: "en"\|"hi"\|"fr", display_name?}` | `{student_id, student_token, classroom, language}` |
| PATCH | `/api/student/me` | `{language}` | same as join |
| GET | `/api/student/lesson?simplified=false` | | `{title, topic, language, simplified, notes}` |
| POST | `/api/student/questions` | `{text, simpler?}` | `{id, text, language, answer, created_at}` |
| GET | `/api/student/questions` | | my questions + answers |
| POST | `/api/student/explain` | `{concept, simpler?}` | `{explanation, example, language}` |
| GET | `/api/student/activities` | | `[{id, template, params, title, explanation, interaction_prompt, quiz_question, quiz_options, quiz_correct_index, quiz_explanation, answered_phases}]` |
| POST | `/api/student/activities/{aid}/responses` | `{answer_index, phase: "pre"\|"post"}` | `{correct, correct_index, explanation}` |

Student activity views are already localized. Only activities the teacher has shared are returned.

### Interactive templates (`GET /api/meta`)
The frontend builds one component per template. The AI only selects the template and fills in its
validated `params`:

| template | params |
|---|---|
| `fraction_pizza` | `{denominators: [4, 8], highlight_slices: 1}` |
| `fraction_bars` | `{fractions: ["1/2", "1/4", "1/8"]}` |
| `number_line` | `{fractions: ["1/4", "3/4"], max_value: 1}` |

### Errors
`403` wrong teacher token · `401` unknown student token · `404` not found · `409` nothing new to analyze /
already answered · `502` AI failure (`{"detail", "error"}`), so show a "try again" message.

## Reliability guards on AI output
- Every AI call requests JSON mode, is validated with Pydantic, and is retried once with the error message.
- Question IDs the model invents are dropped, and each question can belong to only one misconception.
- Unknown templates or bad params fall back to safe defaults, and a missing language falls back to English.
- Re-running the radar replaces only *pending* misconceptions. Questions already handled (approved or
  dismissed) are excluded, so the radar surfaces new problems.

## Layout
```
app/
  main.py            FastAPI app, CORS, error handling
  config.py          env settings, supported languages
  db.py / models.py  SQLAlchemy engine + tables
  schemas.py         request/response models (the API contract)
  deps.py            token auth
  templates.py       interactive template registry + param validation
  routers/teacher.py teacher portal + misconception radar
  routers/student.py student portal
  ai/providers.py    Gemini / OpenAI (REST) / mock
  ai/prompts.py      system prompts
  ai/service.py      structured AI tasks with validation
  ai/mock.py         offline canned provider for tests
scripts/demo.py      end-to-end demo rehearsal
tests/               pytest flow tests
../src/               React website (teacher + student portals), at the repository root
  services/api.ts          real backend client: maps backend data to the UI's types
  services/mockApi.ts what the screens call; forwards to api.ts when VITE_API_URL is set
  lib/session.ts      teacher/student tokens (teacher: localStorage, student: per-tab)
```
