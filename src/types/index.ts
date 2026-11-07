export type Lang = "en" | "hi" | "fr";

export type ClassroomSession = {
  id: string;
  title: string;
  subject: string;
  notes: string;
  joinCode: string;
  status: "draft" | "live" | "ended";
  createdAt: number;
  startedAt?: number | undefined;
};

export type Student = {
  id: string;
  name: string;
  language: Lang;
  joinedAt: number;
};

/** Language as detected by the (future) backend. "unknown" until analyzed. */
export type DetectedLanguage = "English" | "Hindi" | "French" | "Hinglish" | "unknown";

export type StudentQuestion = {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  /** Exactly as typed — never translated or modified. */
  text: string;
  detectedLanguage: DetectedLanguage;
  status: "pending" | "analyzed" | "answered";
  misconceptionId?: string | undefined;
  createdAt: number;
  isDemo?: boolean | undefined;
  /** English translation from the backend (LIVE mode, teacher view). */
  translation?: string | undefined;
  /** AI answer in the student's language (LIVE mode, student view). */
  answer?: string | undefined;
};

export type Misconception = {
  id: string;
  title: string;
  explanation: string;
  questionIds: string[];
  languages: DetectedLanguage[];
  intervention: string;
  severity: "high" | "medium" | "low";
  isDemo: boolean;
};

export type QuizQuestion = {
  id: string;
  prompt: Record<Lang, string>;
  options: string[];
  correctIndex: number;
  feedback: Record<Lang, { correct: string; incorrect: string }>;
};

export type LearningActivity = {
  id: string;
  sessionId: string;
  misconceptionId?: string | undefined;
  type: "fraction-compare";
  title: Record<Lang, string>;
  /** Denominators compared in the visual, e.g. [4, 8]. */
  denominators: [number, number];
  explanation: Record<Lang, string>;
  instructions: Record<Lang, string>;
  quiz: QuizQuestion;
  status: "draft" | "shared";
  sharedAt?: number | undefined;
};

export type QuizResponse = {
  id: string;
  activityId: string;
  studentId: string;
  selectedIndex: number;
  correct: boolean;
  createdAt: number;
};

export type AppState = {
  session: ClassroomSession;
  students: Student[];
  questions: StudentQuestion[];
  misconceptions: Misconception[];
  activities: LearningActivity[];
  quizResponses: QuizResponse[];
};
