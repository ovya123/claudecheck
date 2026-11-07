/**
 * API layer used by every screen.
 * - LIVE mode (VITE_API_URL set): each function forwards to the real backend in ./api.ts.
 * - DEMO mode: the original mock behaviour below; misconception results are demo data.
 */
import type { ClassroomSession, Lang, LearningActivity, Misconception, QuizResponse, Student, StudentQuestion } from "@/types";
import { getState, setState, setStudentId } from "@/lib/store";
import { explanations, lessonContent, type ExplanationLevel } from "@/i18n";
import { fractionActivityTemplate } from "@/data/demo";
import { LIVE } from "@/lib/config";
import * as api from "@/services/api";

export {
  analyzeQuestions, createAssignment, deleteAssignment, ensureStudentLanguage, getParentOverview, saveGrades, translateUiStrings, getParentStatus, getParentTips, getStudentFamily, linkParent,
  setParentLanguage, setParentVerification, signOutParent, useLesson, useLiveSync,
} from "@/services/api";
export type {
  ClassMistake, ParentActivity, ParentAssignment, ParentOverview, ParentQuestion, ParentStatus, ParentTips, StudentFamily, WeakArea,
} from "@/services/api";

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createSession(input: { title: string; subject: string; notes: string }): Promise<ClassroomSession> {
  if (LIVE) return api.createSession(input);
  await delay();
  const session: ClassroomSession = { id: uid("sess"), ...input, joinCode: generateJoinCode(), status: "draft", createdAt: Date.now() };
  setState((s) => ({ ...s, session, students: [], questions: [], misconceptions: [], activities: [fractionActivityTemplate(session.id)], quizResponses: [] }));
  return session;
}

export async function setSessionStatus(status: ClassroomSession["status"]): Promise<void> {
  if (LIVE) return api.setSessionStatus(status);
  await delay(200);
  setState((s) => ({ ...s, session: { ...s.session, status, startedAt: status === "live" ? Date.now() : s.session.startedAt } }));
}

export class JoinError extends Error {}

export async function joinSession(input: { code: string; name: string; language: Lang }): Promise<Student> {
  if (LIVE) return api.joinSession(input);
  await delay(500);
  const { session } = getState();
  if (input.code.trim().toUpperCase() !== session.joinCode) throw new JoinError("No classroom found with that code.");
  if (session.status === "ended") throw new JoinError("This session has ended.");
  const student: Student = { id: uid("stu"), name: input.name.trim(), language: input.language, joinedAt: Date.now() };
  setState((s) => ({ ...s, students: [...s.students, student] }));
  setStudentId(student.id);
  return student;
}

export async function submitQuestion(input: { studentId: string; studentName: string; text: string }): Promise<StudentQuestion> {
  if (LIVE) return api.submitQuestion(input);
  await delay(300);
  const { session } = getState();
  const question: StudentQuestion = {
    id: uid("q"), sessionId: session.id, studentId: input.studentId, studentName: input.studentName,
    text: input.text, // preserved exactly as typed
    detectedLanguage: "unknown", status: "pending", createdAt: Date.now(),
  };
  setState((s) => ({ ...s, questions: [...s.questions, question] }));
  return question;
}

export async function markAnswered(questionId: string): Promise<void> {
  if (LIVE) return api.markAnswered(questionId);
  await delay(150);
  setState((s) => ({ ...s, questions: s.questions.map((q) => (q.id === questionId ? { ...q, status: "answered" } : q)) }));
}

export async function getSessionQuestions(): Promise<StudentQuestion[]> {
  await delay();
  return getState().questions;
}

/** Future: POST questions to an AI endpoint returning Misconception[]. */
export async function getMisconceptions(): Promise<Misconception[]> {
  await delay();
  return getState().misconceptions;
}

export async function generateExplanation(input: { lang: Lang; level: ExplanationLevel; fail?: boolean }): Promise<string[]> {
  if (LIVE) return api.generateExplanation(input);
  await delay(700);
  if (input.fail) throw new Error("Explanation service unavailable");
  return explanations[input.lang][input.level];
}

export async function getLessonTranslation(lang: Lang) {
  if (LIVE) return api.getLessonTranslation(lang);
  await delay(120);
  return lessonContent[lang];
}

export async function generateMiniLesson(misconceptionId: string): Promise<LearningActivity> {
  if (LIVE) return api.generateMiniLesson(misconceptionId);
  await delay(900);
  const existing = getState().activities.find((a) => a.misconceptionId === misconceptionId);
  if (existing) return existing;
  const act = { ...fractionActivityTemplate(getState().session.id, misconceptionId), id: uid("act") };
  setState((s) => ({ ...s, activities: [...s.activities, act] }));
  return act;
}

export async function shareActivity(activityId: string): Promise<void> {
  if (LIVE) return api.shareActivity(activityId);
  await delay(400);
  setState((s) => ({ ...s, activities: s.activities.map((a) => (a.id === activityId ? { ...a, status: "shared", sharedAt: Date.now() } : a)) }));
}

export async function submitQuizResponse(input: { activityId: string; studentId: string; selectedIndex: number }): Promise<QuizResponse> {
  if (LIVE) return api.submitQuizResponse(input);
  await delay(250);
  const act = getState().activities.find((a) => a.id === input.activityId);
  const response: QuizResponse = { id: uid("qr"), ...input, correct: act?.quiz.correctIndex === input.selectedIndex, createdAt: Date.now() };
  setState((s) => ({ ...s, quizResponses: [...s.quizResponses, response] }));
  return response;
}
