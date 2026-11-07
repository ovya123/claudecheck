/**
 * Real backend client (LIVE mode). Talks to the ClassBridge FastAPI backend and maps its
 * responses onto the frontend's existing types, so screens don't need to know the difference.
 * mockApi.ts forwards to these functions whenever VITE_API_URL is set.
 */
import { useEffect, useState } from "react";
import type {
  AppState, ClassroomSession, DetectedLanguage, Lang, LearningActivity, Misconception, QuizResponse, Student, StudentQuestion,
} from "@/types";
import { API_URL, LIVE } from "@/lib/config";
import { getState, setState } from "@/lib/store";
import {
  emptyState, getStudentCreds, getTeacherCreds, setStudentCreds, setTeacherCreds, studentBaseState, teacherSession,
  type StudentCreds, type TeacherCreds,
} from "@/lib/session";
import { lessonContent, type ExplanationLevel } from "@/i18n";

const LANGS: Lang[] = ["en", "hi", "fr"];
const POLL_MS = 3000;

// ---------------------------------------------------------------- HTTP

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", ...init.headers },
      body: init.body === undefined ? null : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the ClassBridge server. Is the backend running?");
  }
  const data = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

const teacherHeaders = (c: TeacherCreds) => ({ "X-Teacher-Token": c.token });
const studentHeaders = (c: StudentCreds) => ({ "X-Student-Token": c.token });

function requireTeacher(): TeacherCreds {
  const c = getTeacherCreds();
  if (!c) throw new Error("Create a session first.");
  return c;
}
function requireStudent(): StudentCreds {
  const c = getStudentCreds();
  if (!c) throw new Error("Join a class first.");
  return c;
}

// ---------------------------------------------------------------- backend shapes

type Localized = Record<string, string>;
type BQuestion = { id: number; text: string; language: string; english_translation: string; concept: string; created_at: string };
type BStudentQuestion = { id: number; text: string; language: string; answer: string; created_at: string };
type BMisconception = {
  id: number; title: string; description: string; teacher_insight: string; confidence: number; status: string;
  languages: string[]; supporting_questions: BQuestion[];
  interventions: { title: string; description: string; template: string; rationale: string }[];
};
type BActivity = {
  id: number; misconception_id: number | null; template: string; params: Record<string, unknown>;
  content: Record<string, { title: string; explanation: string; interaction_prompt: string }>;
  quiz: { question: Localized; options: Localized[]; correct_index: number; explanation: Localized };
  status: string; created_at: string;
};
type BStudentActivity = {
  id: number; template: string; params: Record<string, unknown>; title: string; explanation: string; interaction_prompt: string;
  quiz_question: string; quiz_options: string[]; quiz_correct_index: number; quiz_explanation: string; created_at: string;
};
type BPhase = { responses: number; correct: number; percent_correct: number | null; option_counts: number[] };
type BDashboard = {
  classroom: { id: number; code: string; title: string; topic: string; lesson_notes: string; created_at: string };
  students: { id: number; display_name: string | null; language: string; created_at: string }[];
  questions: BQuestion[];
  misconceptions: BMisconception[];
  activities: { activity: BActivity; results: { pre: BPhase; post: BPhase } }[];
};

// ---------------------------------------------------------------- mapping helpers

/** Backend timestamps from SQLite have no timezone; they are UTC. */
const ts = (s: string) => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);

const LANG_NAMES: Record<string, DetectedLanguage> = { en: "English", hi: "Hindi", fr: "French" };
const detected = (code: string): DetectedLanguage => LANG_NAMES[code] ?? "unknown";
const asLang = (code: string): Lang => (code === "hi" || code === "fr" ? code : "en");
const pick = (rec: Localized | undefined, lang: string) => rec?.[lang] || rec?.["en"] || Object.values(rec ?? {})[0] || "";
const perLang = (f: (l: Lang) => string) => Object.fromEntries(LANGS.map((l) => [l, f(l)])) as Record<Lang, string>;

const NOT_QUITE: Record<Lang, string> = {
  en: "Not quite — look at the pizzas again and try once more.",
  hi: "पूरी तरह नहीं — पिज़्ज़ा को फिर से देखें और एक बार और कोशिश करें।",
  fr: "Pas tout à fait — regarde encore les pizzas et réessaie.",
};

/** The frontend has one interactive template (two pizzas); derive its two denominators. */
function denominators(template: string, params: Record<string, unknown>): [number, number] {
  let ds: number[] = [];
  if (template === "fraction_pizza" && Array.isArray(params["denominators"])) ds = params["denominators"] as number[];
  else if (Array.isArray(params["fractions"])) ds = (params["fractions"] as string[]).map((f) => Number(String(f).split("/")[1]));
  const unique = [...new Set(ds.filter((d) => Number.isInteger(d) && d >= 2 && d <= 12))];
  return unique.length >= 2 ? [unique[0]!, unique[1]!] : [4, 8];
}

function severity(n: number): Misconception["severity"] {
  return n >= 3 ? "high" : n === 2 ? "medium" : "low";
}

function mapTeacherActivity(a: BActivity, sessionId: string): LearningActivity {
  const c = (l: Lang) => a.content[l] ?? a.content["en"] ?? Object.values(a.content)[0];
  return {
    id: String(a.id),
    sessionId,
    misconceptionId: a.misconception_id == null ? undefined : String(a.misconception_id),
    type: "fraction-compare",
    denominators: denominators(a.template, a.params),
    title: perLang((l) => c(l)?.title ?? ""),
    instructions: perLang((l) => c(l)?.interaction_prompt ?? ""),
    explanation: perLang((l) => c(l)?.explanation ?? ""),
    quiz: {
      id: `quiz-${a.id}`,
      prompt: perLang((l) => pick(a.quiz.question, l)),
      options: a.quiz.options.map((o) => pick(o, "en")),
      correctIndex: a.quiz.correct_index,
      feedback: Object.fromEntries(LANGS.map((l) => [l, { correct: pick(a.quiz.explanation, l), incorrect: NOT_QUITE[l] }])) as LearningActivity["quiz"]["feedback"],
    },
    status: a.status === "draft" ? "draft" : "shared",
    sharedAt: a.status === "draft" ? undefined : ts(a.created_at),
  };
}

/** Student view comes back already in the student's language; reuse it for every UI language. */
function mapStudentActivity(a: BStudentActivity, sessionId: string, lang: Lang): LearningActivity {
  const same = (s: string) => perLang(() => s);
  return {
    id: String(a.id),
    sessionId,
    type: "fraction-compare",
    denominators: denominators(a.template, a.params),
    title: same(a.title),
    instructions: same(a.interaction_prompt),
    explanation: same(a.explanation),
    quiz: {
      id: `quiz-${a.id}`,
      prompt: same(a.quiz_question),
      options: a.quiz_options,
      correctIndex: a.quiz_correct_index,
      feedback: Object.fromEntries(LANGS.map((l) => [l, { correct: a.quiz_explanation, incorrect: NOT_QUITE[lang] }])) as LearningActivity["quiz"]["feedback"],
    },
    status: "shared",
    sharedAt: ts(a.created_at),
  };
}

function teacherStateFrom(d: BDashboard, c: TeacherCreds): AppState {
  const sessionId = String(d.classroom.id);
  const owner = new Map<number, string>();
  for (const m of d.misconceptions) for (const q of m.supporting_questions) owner.set(q.id, String(m.id));
  const answered = new Set(c.answered);

  const questions: StudentQuestion[] = d.questions.map((q) => ({
    id: String(q.id),
    sessionId,
    // Questions are anonymous by design: the backend never tells the teacher who asked.
    studentId: `anon-${q.id}`,
    studentName: "Anonymous student",
    text: q.text,
    detectedLanguage: detected(q.language),
    status: answered.has(String(q.id)) ? "answered" : owner.has(q.id) ? "analyzed" : "pending",
    misconceptionId: owner.get(q.id),
    createdAt: ts(q.created_at),
    translation: q.language !== "en" ? q.english_translation : undefined,
  }));

  const misconceptions: Misconception[] = d.misconceptions
    .filter((m) => m.status !== "dismissed")
    .map((m) => {
      const iv = m.interventions[0];
      return {
        id: String(m.id),
        title: m.title,
        explanation: m.description,
        questionIds: m.supporting_questions.map((q) => String(q.id)),
        languages: m.languages.map(detected),
        intervention: iv ? `${iv.title}: ${iv.description}` : m.teacher_insight,
        severity: severity(m.supporting_questions.length),
        isDemo: false,
      };
    });

  const activities = d.activities.map(({ activity }) => mapTeacherActivity(activity, sessionId));

  // The backend aggregates quiz answers per activity; expand them back into individual responses.
  const quizResponses: QuizResponse[] = d.activities.flatMap(({ activity, results }) =>
    Array.from({ length: results.post.responses }, (_, i) => ({
      id: `qr-${activity.id}-${i}`, activityId: String(activity.id), studentId: "", selectedIndex: -1,
      correct: i < results.post.correct, createdAt: 0,
    })),
  );

  const students: Student[] = d.students.map((s, i) => ({
    id: String(s.id), name: s.display_name || `Student ${i + 1}`, language: asLang(s.language), joinedAt: ts(s.created_at),
  }));

  return { session: teacherSession(c), students, questions, misconceptions, activities, quizResponses };
}

// ---------------------------------------------------------------- teacher

export async function refreshTeacher(): Promise<void> {
  const c = getTeacherCreds();
  if (!c) return;
  try {
    const d = await request<BDashboard>(`/api/teacher/classrooms/${c.classroomId}/dashboard`, { headers: teacherHeaders(c) });
    // Ignore a stale response if the teacher switched sessions while it was in flight.
    if (getTeacherCreds()?.classroomId !== c.classroomId) return;
    setState(() => teacherStateFrom(d, getTeacherCreds() ?? c));
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
      // The classroom no longer exists on the server (e.g. database was reset).
      setTeacherCreds(null);
      setState(() => emptyState());
    }
  }
}

export async function createSession(input: { title: string; subject: string; notes: string }): Promise<ClassroomSession> {
  const r = await request<{ id: number; code: string; title: string; teacher_token: string }>("/api/classrooms", {
    method: "POST",
    body: { title: input.title, topic: input.subject, lesson_notes: input.notes },
  });
  const c: TeacherCreds = {
    classroomId: r.id, token: r.teacher_token, code: r.code, title: r.title, subject: input.subject, notes: input.notes,
    status: "draft", createdAt: Date.now(), answered: [],
  };
  setTeacherCreds(c);
  setState(() => ({ ...emptyState(), session: teacherSession(c) }));
  void refreshTeacher();
  return teacherSession(c);
}

export async function setSessionStatus(status: ClassroomSession["status"]): Promise<void> {
  const c = requireTeacher();
  const next: TeacherCreds = { ...c, status, startedAt: status === "live" ? Date.now() : c.startedAt };
  setTeacherCreds(next);
  setState((s) => ({ ...s, session: teacherSession(next) }));
}

export async function markAnswered(questionId: string): Promise<void> {
  const c = requireTeacher();
  setTeacherCreds({ ...c, answered: [...new Set([...c.answered, questionId])] });
  setState((s) => ({ ...s, questions: s.questions.map((q) => (q.id === questionId ? { ...q, status: "answered" } : q)) }));
}

/** Run the Cross-Language Misconception Radar over the class's questions. */
export async function analyzeQuestions(): Promise<number> {
  const c = requireTeacher();
  try {
    const r = await request<{ misconceptions: unknown[] }>(`/api/teacher/classrooms/${c.classroomId}/analyze`, {
      method: "POST", headers: teacherHeaders(c),
    });
    await refreshTeacher();
    return r.misconceptions.length;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) throw new Error("No new questions to analyze yet.");
    throw e;
  }
}

export async function generateMiniLesson(misconceptionId: string): Promise<LearningActivity> {
  const existing = getState().activities.find((a) => a.misconceptionId === misconceptionId);
  if (existing) return existing;
  const c = requireTeacher();
  const a = await request<BActivity>(`/api/teacher/classrooms/${c.classroomId}/misconceptions/${misconceptionId}/approve`, {
    method: "POST", headers: teacherHeaders(c), body: { intervention_index: 0 },
  });
  const act = mapTeacherActivity(a, String(c.classroomId));
  setState((s) => ({ ...s, activities: [...s.activities.filter((x) => x.id !== act.id), act] }));
  return act;
}

export async function shareActivity(activityId: string): Promise<void> {
  const c = requireTeacher();
  await request(`/api/teacher/classrooms/${c.classroomId}/activities/${activityId}/share`, { method: "POST", headers: teacherHeaders(c) });
  setState((s) => ({ ...s, activities: s.activities.map((a) => (a.id === activityId ? { ...a, status: "shared", sharedAt: Date.now() } : a)) }));
}

// ---------------------------------------------------------------- student

function mapStudentQuestion(q: BStudentQuestion, c: StudentCreds): StudentQuestion {
  return {
    id: String(q.id), sessionId: c.code, studentId: String(c.studentId), studentName: c.name, text: q.text,
    detectedLanguage: detected(q.language), status: q.answer ? "answered" : "pending", createdAt: ts(q.created_at),
    answer: q.answer || undefined,
  };
}

export async function refreshStudent(): Promise<void> {
  const c = getStudentCreds();
  if (!c) return;
  try {
    const [qs, acts] = await Promise.all([
      request<BStudentQuestion[]>("/api/student/questions", { headers: studentHeaders(c) }),
      request<BStudentActivity[]>("/api/student/activities", { headers: studentHeaders(c) }),
    ]);
    if (getStudentCreds()?.token !== c.token) return;
    setState(() => ({
      ...studentBaseState(c),
      questions: qs.map((q) => mapStudentQuestion(q, c)),
      // Oldest first so new activities appear at the bottom, like the teacher list.
      activities: acts.map((a) => mapStudentActivity(a, c.code, c.language)).reverse(),
    }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setStudentCreds(null);
      setState(() => emptyState());
    }
  }
}

export class JoinError extends Error {}

export async function joinSession(input: { code: string; name: string; language: Lang }): Promise<Student> {
  const code = input.code.trim().toUpperCase();
  let r: { student_id: number; student_token: string; classroom: { code: string; title: string; topic: string }; language: string };
  try {
    r = await request(`/api/join/${encodeURIComponent(code)}`, {
      method: "POST", body: { language: input.language, display_name: input.name.trim() },
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new JoinError("No classroom found with that code.");
    throw e;
  }
  const c: StudentCreds = {
    studentId: r.student_id, token: r.student_token, name: input.name.trim(), language: asLang(r.language),
    code: r.classroom.code, title: r.classroom.title, topic: r.classroom.topic, joinedAt: Date.now(),
  };
  setStudentCreds(c);
  setState(() => studentBaseState(c));
  void refreshStudent();
  return { id: String(c.studentId), name: c.name, language: c.language, joinedAt: c.joinedAt };
}

/** Keep the backend's idea of the student's language in sync with the UI language. */
export async function ensureStudentLanguage(lang: Lang): Promise<void> {
  const c = getStudentCreds();
  if (!c || c.language === lang) return;
  await request("/api/student/me", { method: "PATCH", headers: studentHeaders(c), body: { language: lang } });
  const latest = getStudentCreds();
  if (latest?.token === c.token) setStudentCreds({ ...latest, language: lang });
  void refreshStudent();
}

export async function submitQuestion(input: { text: string }): Promise<StudentQuestion> {
  const c = requireStudent();
  const q = await request<BStudentQuestion>("/api/student/questions", {
    method: "POST", headers: studentHeaders(c), body: { text: input.text },
  });
  const mapped = mapStudentQuestion(q, c);
  setState((s) => ({ ...s, questions: [...s.questions.filter((x) => x.id !== mapped.id), mapped] }));
  return mapped;
}

export async function submitQuizResponse(input: { activityId: string; selectedIndex: number }): Promise<QuizResponse> {
  const c = requireStudent();
  const act = getState().activities.find((a) => a.id === input.activityId);
  let correct = act?.quiz.correctIndex === input.selectedIndex;
  try {
    const r = await request<{ correct: boolean }>(`/api/student/activities/${input.activityId}/responses`, {
      method: "POST", headers: studentHeaders(c), body: { answer_index: input.selectedIndex, phase: "post" },
    });
    correct = r.correct;
  } catch (e) {
    // 409 = this student already answered; only the first attempt counts towards results.
    if (!(e instanceof ApiError && e.status === 409)) throw e;
  }
  return {
    id: `qr-${input.activityId}-${c.studentId}`, activityId: input.activityId, studentId: String(c.studentId),
    selectedIndex: input.selectedIndex, correct, createdAt: Date.now(),
  };
}

const sentences = (text: string) =>
  text.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter(Boolean);

export async function generateExplanation(input: { lang: Lang; level: ExplanationLevel }): Promise<string[]> {
  await ensureStudentLanguage(input.lang);
  const c = requireStudent();
  const lesson = c.topic ? `"${c.title}" (${c.topic})` : `"${c.title}"`;
  const concept = input.level === "example"
    ? `A concrete, everyday example that explains the main idea of today's lesson ${lesson}`
    : `The main idea of today's lesson ${lesson}`;
  const r = await request<{ explanation: string; example: string }>("/api/student/explain", {
    method: "POST", headers: studentHeaders(c), body: { concept, simpler: input.level === "simple" },
  });
  const lines = sentences(r.explanation);
  if (r.example) lines.push(r.example);
  return lines;
}

type Lesson = (typeof lessonContent)[Lang];
const lessonCache = new Map<string, Lesson>();

export async function getLessonTranslation(lang: Lang): Promise<Lesson> {
  await ensureStudentLanguage(lang);
  const c = requireStudent();
  const key = `${c.code}:${lang}`;
  const hit = lessonCache.get(key);
  if (hit) return hit;
  const r = await request<{ topic: string; notes: string }>("/api/student/lesson", { headers: studentHeaders(c) });
  const lesson: Lesson = { topic: r.topic || c.title, sections: r.notes ? [{ heading: "", body: r.notes }] : [] };
  lessonCache.set(key, lesson);
  return lesson;
}

// ---------------------------------------------------------------- hooks

/** Poll the backend while a teacher or student page is open (LIVE mode only). */
export function useLiveSync(role: "teacher" | "student") {
  useEffect(() => {
    if (!LIVE) return;
    const refresh = role === "teacher" ? refreshTeacher : refreshStudent;
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [role]);
}

/** Lesson text in the student's language: AI-translated in LIVE mode, built-in sample in DEMO mode. */
export function useLesson(lang: Lang): { lesson: Lesson | null; error: string | null } {
  const [lesson, setLesson] = useState<Lesson | null>(LIVE ? null : lessonContent[lang]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!LIVE) { setLesson(lessonContent[lang]); return; }
    let alive = true;
    setError(null);
    const c = getStudentCreds();
    setLesson(c ? lessonCache.get(`${c.code}:${lang}`) ?? null : null);
    getLessonTranslation(lang)
      .then((l) => alive && setLesson(l))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load the lesson."));
    return () => { alive = false; };
  }, [lang]);
  return { lesson, error };
}
