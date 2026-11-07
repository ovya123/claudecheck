# ClassBridge — Frontend MVP Plan

Frontend-only build with mock data, a Promise-based mock service layer, localStorage persistence and BroadcastChannel sync between teacher and student tabs. No backend, auth or AI calls.

## Visual direction
- Warm off-white background, deep navy text, teal primary, soft blue secondary, amber for misconception alerts.
- Fonts: "Fraunces" (display headings) + "Manrope" (UI/body), loaded via link tags.
- Rounded cards, soft shadows, generous whitespace, restrained transitions, Lucide icons. Light theme only.
- Demo data clearly labeled with a "Demo data" badge wherever AI results or analytics appear.

## Pages (routes)
```text
/                         Landing
/teacher                  Overview (sidebar layout)
/teacher/sessions         Create + manage sessions (join code, copy, start/end)
/teacher/live             Live session: questions, Pending Analysis, Misconception Radar, interventions
/teacher/radar            Full Misconception Radar
/teacher/activities       Learning activities + Mini-lesson preview + "Share With Class"
/teacher/insights         Analytics (Recharts)
/join                     Student join: code, display name, language
/classroom                Student classroom
```

### Landing
Nav + logo, hero "Every student deserves to understand, not just attend.", Teacher/Student buttons, a live-looking Radar preview card, How it Works (3 steps), 4 feature highlights, footer.

### Teacher
- Sidebar (collapsible on mobile), top bar with classroom indicator and avatar.
- Overview: welcome, Create Session button, active class card, stat cards (students, questions, misconceptions), questions-over-time chart, recent questions, quick link to radar.
- Sessions: form (title, subject, notes) with validation, generates 6-char code, copy button, start/end toggle.
- Live: live pulse indicator, code, joined count, incoming question feed (original text + language tag), Pending Analysis list, prominent Radar with expandable cards (title, explanation, count, language chips, supporting questions, suggested intervention, View Details dialog, Generate Mini-Lesson). Separate concepts stay separate.
- Activities: mini-lesson preview, Share With Class.
- Insights: questions submitted, misconception categories, interventions shared, quiz submissions, correct %, trend only when quiz data exists; empty states otherwise.

### Student
- Join: code validation against the active session, name, language (English/Hindi/French).
- Classroom: persistent top-right language switcher updating UI labels, lesson content, explanations, mini-lesson and quiz instructions instantly, stored locally. Lesson panel with "Explain Simply". Question composer (any script, Hinglish, character counter, no translation), history with pending/answered states. Explanation panel with Explain More Simply / Give Me an Example, loading skeletons and error state. Shared activity appears when teacher shares it.

### Interactive mini-lesson (reusable template)
Two equal fraction bars/pizzas (SVG), toggle 1/4 vs 1/8, click slices to shade, size comparison, localized explanation, then quiz "Which is larger: 1/3 or 1/6?" with instant feedback and completion state. Configurable via props (fractions, text per language, quiz).

## Technical details
- `src/types/` models: ClassroomSession, Student, StudentQuestion, Misconception, LearningActivity, QuizQuestion, QuizResponse.
- `src/services/mockApi.ts`: createSession, joinSession, submitQuestion, getSessionQuestions, getMisconceptions, generateExplanation, getLessonTranslation, shareActivity, submitQuizResponse — async with small delays, isolated so they can be replaced by real endpoints.
- `src/lib/store.ts`: localStorage-backed state + BroadcastChannel ("classbridge") with a React hook for live sync across tabs.
- `src/i18n/`: UI dictionary (en/hi/fr) + translated lesson/explanation content; `useLanguage` hook.
- `src/data/demo.ts`: "Introduction to Fractions" session, sample multilingual questions and demo misconception results.
- Components under `src/components/{landing,teacher,student,lesson,radar}`; Recharts for charts; sonner toasts mounted in root.
- Each route gets its own head() metadata.
