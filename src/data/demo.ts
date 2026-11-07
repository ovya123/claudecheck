import type { AppState, LearningActivity } from "@/types";

const T0 = 1762526400000; // fixed timestamp so SSR and client agree

export function fractionActivityTemplate(sessionId: string, misconceptionId?: string): LearningActivity {
  return {
    id: "act-fractions-1",
    sessionId,
    misconceptionId,
    type: "fraction-compare",
    denominators: [4, 8],
    status: "draft",
    title: {
      en: "Bigger denominator, smaller piece",
      hi: "बड़ा हर, छोटा टुकड़ा",
      fr: "Plus grand dénominateur, plus petite part",
    },
    instructions: {
      en: "Switch between the two fractions and tap slices to shade them. Compare how much of each pizza you get.",
      hi: "दोनों भिन्नों के बीच बदलें और टुकड़ों को छूकर रंगें। देखें कि हर पिज़्ज़ा का कितना हिस्सा मिलता है।",
      fr: "Alterne entre les deux fractions et touche les parts pour les colorier. Compare la quantité de pizza obtenue.",
    },
    explanation: {
      en: "Both pizzas are the same size. When you cut a pizza into 8 pieces instead of 4, each piece must be smaller. So 1/8 is less than 1/4 — the denominator tells you how many pieces the whole is shared into.",
      hi: "दोनों पिज़्ज़ा एक ही आकार के हैं। जब पिज़्ज़ा को 4 की जगह 8 टुकड़ों में काटते हैं, तो हर टुकड़ा छोटा हो जाता है। इसलिए 1/8, 1/4 से छोटा है — हर बताता है कि पूरे को कितने हिस्सों में बाँटा गया है।",
      fr: "Les deux pizzas ont la même taille. Si on coupe une pizza en 8 parts au lieu de 4, chaque part devient plus petite. Donc 1/8 est plus petit que 1/4 — le dénominateur indique en combien de parts le tout est partagé.",
    },
    quiz: {
      id: "quiz-1",
      prompt: {
        en: "Which fraction is larger: 1/3 or 1/6?",
        hi: "कौन सी भिन्न बड़ी है: 1/3 या 1/6?",
        fr: "Quelle fraction est la plus grande : 1/3 ou 1/6 ?",
      },
      options: ["1/3", "1/6", "They are equal"],
      correctIndex: 0,
      feedback: {
        en: { correct: "Exactly! Sharing into 3 parts gives bigger pieces than sharing into 6.", incorrect: "Not quite. Picture the same pizza cut into 3 or into 6 — which slices are bigger?" },
        hi: { correct: "बिल्कुल सही! 3 हिस्सों में बाँटने पर टुकड़े 6 हिस्सों से बड़े होते हैं।", incorrect: "पूरी तरह नहीं। एक ही पिज़्ज़ा को 3 या 6 में काटें — कौन से टुकड़े बड़े होंगे?" },
        fr: { correct: "Exactement ! Partager en 3 donne des parts plus grandes qu'en 6.", incorrect: "Pas tout à fait. Imagine la même pizza coupée en 3 ou en 6 — quelles parts sont plus grandes ?" },
      },
    },
  };
}

export function createDemoState(): AppState {
  const sessionId = "sess-fractions";
  const q = (id: string, name: string, text: string, lang: AppState["questions"][number]["detectedLanguage"], mid: string | undefined, mins: number) => ({
    id, sessionId, studentId: `stu-${id}`, studentName: name, text, detectedLanguage: lang,
    status: mid ? ("analyzed" as const) : ("pending" as const), misconceptionId: mid, createdAt: T0 + mins * 60000, isDemo: true,
  });
  return {
    session: {
      id: sessionId,
      title: "Introduction to Fractions",
      subject: "Mathematics · Grade 5",
      notes: "A fraction shows part of a whole. The bottom number (denominator) tells how many equal parts the whole is divided into. The top number (numerator) tells how many of those parts we have.",
      joinCode: "FRC24B",
      status: "live",
      createdAt: T0,
      startedAt: T0,
    },
    students: [
      ["Aarav", "hi"], ["Léa", "fr"], ["Maya", "en"], ["Rohan", "hi"], ["Chloé", "fr"],
      ["Daniel", "en"], ["Priya", "hi"], ["Hugo", "fr"], ["Sara", "en"], ["Kabir", "hi"],
      ["Amélie", "fr"], ["Noah", "en"], ["Isha", "hi"], ["Lucas", "fr"], ["Zara", "en"],
      ["Vihaan", "hi"], ["Emma", "en"], ["Arjun", "hi"], ["Inès", "fr"], ["Oliver", "en"],
      ["Diya", "hi"], ["Théo", "fr"], ["Ava", "en"], ["Neel", "hi"],
    ].map(([name, language], i) => ({ id: `stu-d${i}`, name: name ?? "", language: language as "en", joinedAt: T0 + i * 20000 })),
    questions: [
      q("q1", "Maya", "Why is 1/8 smaller than 1/4?", "English", "m1", 4),
      q("q2", "Aarav", "बड़ा हर होने पर भिन्न छोटी क्यों होती है?", "Hindi", "m1", 6),
      q("q3", "Léa", "Pourquoi un plus grand dénominateur donne-t-il une plus petite fraction ?", "French", "m1", 7),
      q("q4", "Rohan", "Agar denominator bada hai toh fraction chota kyun hota hai?", "Hinglish", "m1", 9),
      q("q5", "Daniel", "Isn't 8 bigger than 4 so 1/8 should be more?", "English", "m1", 10),
      q("q6", "Chloé", "Est-ce que 2/4 et 1/2 c'est vraiment pareil ?", "French", "m2", 12),
      q("q7", "Priya", "2/4 aur 1/2 same kaise ho sakte hain?", "Hinglish", "m2", 13),
      q("q8", "Sara", "Can I add 1/2 + 1/3 by adding tops and bottoms to get 2/5?", "English", "m3", 15),
      q("q9", "Hugo", "Le numérateur, c'est en haut ou en bas ?", "unknown", undefined, 17),
      q("q10", "Kabir", "Pizza ke 3 tukde kiye toh har ek kitna hai?", "unknown", undefined, 18),
    ],
    misconceptions: [
      {
        id: "m1",
        title: "Larger denominator read as a larger fraction",
        explanation: "Students are comparing denominators as whole numbers (8 > 4) instead of understanding that a larger denominator means the whole is split into more, smaller parts.",
        questionIds: ["q1", "q2", "q3", "q4", "q5"],
        languages: ["English", "Hindi", "French", "Hinglish"],
        intervention: "Show two identical wholes cut into 4 and 8 parts side by side. Ask students to predict which single piece is bigger before revealing.",
        severity: "high",
        isDemo: true,
      },
      {
        id: "m2",
        title: "Unsure that equivalent fractions are equal",
        explanation: "Students see different numbers (2/4 vs 1/2) and assume different values, without recognising the same amount of the whole is shaded.",
        questionIds: ["q6", "q7"],
        languages: ["French", "Hinglish"],
        intervention: "Fold a paper strip in half, then fold again. Shade 1/2 and show it covers exactly 2/4.",
        severity: "medium",
        isDemo: true,
      },
      {
        id: "m3",
        title: "Adding numerators and denominators directly",
        explanation: "A student applies whole-number addition to both parts of a fraction, giving 1/2 + 1/3 = 2/5.",
        questionIds: ["q8"],
        languages: ["English"],
        intervention: "Use a number line: 1/2 + 1/3 must be more than 1/2, so 2/5 cannot be right. Introduce common denominators next lesson.",
        severity: "low",
        isDemo: true,
      },
    ],
    activities: [fractionActivityTemplate(sessionId, "m1")],
    quizResponses: [],
  };
}

/** Demo-only trend data for the overview chart. */
export const demoQuestionTimeline = [
  { t: "0′", questions: 0 }, { t: "3′", questions: 1 }, { t: "6′", questions: 3 }, { t: "9′", questions: 4 },
  { t: "12′", questions: 6 }, { t: "15′", questions: 8 }, { t: "18′", questions: 10 },
];
