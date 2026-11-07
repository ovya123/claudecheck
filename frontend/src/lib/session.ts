import type { AppState, ClassroomSession, Lang } from "@/types";

/**
 * Who this browser tab is, in LIVE mode.
 * - Teacher credentials live in localStorage (survive refreshes and new tabs).
 * - Student credentials live in sessionStorage, so every tab can be a different student
 *   (handy for demoing several students from one laptop).
 */
export type TeacherCreds = {
  classroomId: number;
  token: string;
  code: string;
  title: string;
  subject: string;
  notes: string;
  status: ClassroomSession["status"];
  createdAt: number;
  startedAt?: number | undefined;
  /** Question ids the teacher marked as answered (kept in this browser only). */
  answered: string[];
};

export type StudentCreds = {
  studentId: number;
  token: string;
  name: string;
  language: Lang;
  code: string;
  title: string;
  topic: string;
  joinedAt: number;
};

/** A parent's link to their child, stored on the parent's own device. */
export type ParentCreds = {
  parentId: number;
  token: string;
  name: string;
  relation: string;
  language: string;
  childName: string;
  classroomTitle: string;
};

const TEACHER_KEY = "classbridge:live:teacher";
const PARENT_KEY = "classbridge:live:parent";
const STUDENT_KEY = "classbridge:live:student";

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(storage: () => Storage, key: string, value: unknown) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable (private mode) — keep going in memory */ }
}
const local = () => window.localStorage;
const sess = () => window.sessionStorage;
const hasWindow = () => typeof window !== "undefined";

export const getTeacherCreds = () => (hasWindow() ? read<TeacherCreds>(local, TEACHER_KEY) : null);
export const setTeacherCreds = (c: TeacherCreds | null) => hasWindow() && write(local, TEACHER_KEY, c);
export const getStudentCreds = () => (hasWindow() ? read<StudentCreds>(sess, STUDENT_KEY) : null);
export const setStudentCreds = (c: StudentCreds | null) => hasWindow() && write(sess, STUDENT_KEY, c);

export const getParentCreds = () => (hasWindow() ? read<ParentCreds>(local, PARENT_KEY) : null);
export const setParentCreds = (c: ParentCreds | null) => hasWindow() && write(local, PARENT_KEY, c);

export function emptyState(): AppState {
  return {
    session: { id: "", title: "No session yet", subject: "Create a session to get a join code", notes: "", joinCode: "------", status: "draft", createdAt: 0 },
    students: [],
    questions: [],
    misconceptions: [],
    activities: [],
    quizResponses: [],
  };
}

export function teacherSession(c: TeacherCreds): ClassroomSession {
  return {
    id: String(c.classroomId), title: c.title, subject: c.subject, notes: c.notes, joinCode: c.code,
    status: c.status, createdAt: c.createdAt, startedAt: c.startedAt,
  };
}

export function studentBaseState(c: StudentCreds): AppState {
  return {
    ...emptyState(),
    session: { id: c.code, title: c.title, subject: c.topic, notes: "", joinCode: c.code, status: "live", createdAt: c.joinedAt },
    students: [{ id: String(c.studentId), name: c.name, language: c.language, joinedAt: c.joinedAt }],
  };
}

/** First paint in LIVE mode, before the backend has answered. */
export function seedLiveState(): AppState {
  const t = getTeacherCreds();
  if (t) return { ...emptyState(), session: teacherSession(t) };
  const s = getStudentCreds();
  if (s) return studentBaseState(s);
  return emptyState();
}
