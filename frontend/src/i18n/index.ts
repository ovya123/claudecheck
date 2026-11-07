import { useSyncExternalStore } from "react";
import type { Lang } from "@/types";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "fr", label: "French", native: "Français" },
];

const dict = {
  en: {
    live: "Live", lesson: "Lesson", currentTopic: "Current topic", notes: "Teacher's notes",
    explainSimply: "Explain simply", askPrivately: "Ask a private question",
    askHint: "Type in any language or script — Hindi, French, Hinglish, anything. Only your teacher sees it.",
    placeholder: "What's confusing you?", submit: "Submit question", yourQuestions: "Your questions",
    noQuestions: "No questions yet. Nothing is too small to ask.", pending: "Waiting", answered: "Answered", seen: "Seen by teacher",
    explanation: "Explanation for you", moreSimply: "Explain more simply", example: "Give me an example",
    loading: "Preparing your explanation…", error: "Couldn't load the explanation.", retry: "Try again",
    sharedActivity: "Activity from your teacher", noActivity: "When your teacher shares an activity, it will appear here.",
    quiz: "Quick check", done: "Activity complete", tryAgain: "Try again", chars: "characters",
    leave: "Leave", hello: "Hi", sample: "Sample explanation",
    whole: "Same-size whole", pieceOf: "One piece of", compare: "Compare", isBigger: "is bigger than",
  },
  hi: {
    live: "लाइव", lesson: "पाठ", currentTopic: "वर्तमान विषय", notes: "शिक्षक के नोट्स",
    explainSimply: "आसान भाषा में समझाएँ", askPrivately: "निजी प्रश्न पूछें",
    askHint: "किसी भी भाषा या लिपि में लिखें — हिन्दी, फ़्रेंच, Hinglish, कुछ भी। केवल आपके शिक्षक इसे देखेंगे।",
    placeholder: "आपको क्या समझ नहीं आ रहा?", submit: "प्रश्न भेजें", yourQuestions: "आपके प्रश्न",
    noQuestions: "अभी कोई प्रश्न नहीं। कोई भी प्रश्न छोटा नहीं होता।", pending: "प्रतीक्षा में", answered: "उत्तर दिया गया", seen: "शिक्षक ने देखा",
    explanation: "आपके लिए व्याख्या", moreSimply: "और आसान भाषा में", example: "एक उदाहरण दें",
    loading: "आपकी व्याख्या तैयार हो रही है…", error: "व्याख्या लोड नहीं हो सकी।", retry: "फिर कोशिश करें",
    sharedActivity: "आपके शिक्षक की गतिविधि", noActivity: "जब शिक्षक कोई गतिविधि साझा करेंगे, वह यहाँ दिखेगी।",
    quiz: "छोटी जाँच", done: "गतिविधि पूरी हुई", tryAgain: "फिर कोशिश करें", chars: "अक्षर",
    leave: "बाहर जाएँ", hello: "नमस्ते", sample: "नमूना व्याख्या",
    whole: "एक जैसा पूरा", pieceOf: "एक टुकड़ा", compare: "तुलना", isBigger: "बड़ा है",
  },
  fr: {
    live: "En direct", lesson: "Leçon", currentTopic: "Sujet actuel", notes: "Notes de l'enseignant",
    explainSimply: "Explique simplement", askPrivately: "Poser une question privée",
    askHint: "Écris dans n'importe quelle langue ou écriture — hindi, français, hinglish… Seul ton enseignant la verra.",
    placeholder: "Qu'est-ce qui te pose problème ?", submit: "Envoyer la question", yourQuestions: "Tes questions",
    noQuestions: "Aucune question pour l'instant. Aucune question n'est trop petite.", pending: "En attente", answered: "Répondu", seen: "Vue par l'enseignant",
    explanation: "Explication pour toi", moreSimply: "Explique plus simplement", example: "Donne-moi un exemple",
    loading: "Préparation de ton explication…", error: "Impossible de charger l'explication.", retry: "Réessayer",
    sharedActivity: "Activité de ton enseignant", noActivity: "Quand ton enseignant partagera une activité, elle apparaîtra ici.",
    quiz: "Petite vérification", done: "Activité terminée", tryAgain: "Réessayer", chars: "caractères",
    leave: "Quitter", hello: "Salut", sample: "Explication exemple",
    whole: "Tout de même taille", pieceOf: "Une part de", compare: "Comparer", isBigger: "est plus grand que",
  },
} satisfies Record<Lang, Record<string, string>>;

export type DictKey = keyof (typeof dict)["en"];
export const t = (lang: Lang, key: DictKey) => dict[lang][key] ?? dict.en[key];

/** Predefined translated lesson content. A future backend can return the same shape. */
export const lessonContent: Record<Lang, { topic: string; sections: { heading: string; body: string }[] }> = {
  en: {
    topic: "Comparing unit fractions",
    sections: [
      { heading: "What is a fraction?", body: "A fraction shows part of a whole. In 3/4, the whole is divided into 4 equal parts, and we have 3 of them." },
      { heading: "Numerator and denominator", body: "The top number is the numerator — how many parts we have. The bottom number is the denominator — how many equal parts make the whole." },
      { heading: "Comparing 1/4 and 1/8", body: "If two wholes are the same size, cutting one into more parts makes each part smaller. That is why 1/8 is smaller than 1/4." },
    ],
  },
  hi: {
    topic: "इकाई भिन्नों की तुलना",
    sections: [
      { heading: "भिन्न क्या है?", body: "भिन्न किसी पूरे का एक हिस्सा दिखाती है। 3/4 में पूरे को 4 बराबर हिस्सों में बाँटा गया है, और हमारे पास उनमें से 3 हैं।" },
      { heading: "अंश और हर", body: "ऊपर की संख्या अंश है — हमारे पास कितने हिस्से हैं। नीचे की संख्या हर है — पूरा कितने बराबर हिस्सों से बना है।" },
      { heading: "1/4 और 1/8 की तुलना", body: "अगर दो पूरे एक ही आकार के हैं, तो एक को ज़्यादा हिस्सों में काटने पर हर हिस्सा छोटा हो जाता है। इसीलिए 1/8, 1/4 से छोटा है।" },
    ],
  },
  fr: {
    topic: "Comparer des fractions unitaires",
    sections: [
      { heading: "Qu'est-ce qu'une fraction ?", body: "Une fraction représente une partie d'un tout. Dans 3/4, le tout est partagé en 4 parts égales et on en a 3." },
      { heading: "Numérateur et dénominateur", body: "Le nombre du haut est le numérateur — combien de parts on a. Le nombre du bas est le dénominateur — en combien de parts égales le tout est partagé." },
      { heading: "Comparer 1/4 et 1/8", body: "Si deux touts ont la même taille, couper l'un en plus de parts rend chaque part plus petite. C'est pourquoi 1/8 est plus petit que 1/4." },
    ],
  },
};

export type ExplanationLevel = "standard" | "simple" | "example";
export const explanations: Record<Lang, Record<ExplanationLevel, string[]>> = {
  en: {
    standard: ["The denominator tells you how many equal parts the whole is split into.", "More parts means each part is smaller.", "So when the numerators are the same, the fraction with the bigger denominator is smaller: 1/8 < 1/4."],
    simple: ["Imagine one chocolate bar.", "Share it with 4 friends — everyone gets a big piece.", "Share it with 8 friends — everyone gets a small piece.", "More friends sharing = smaller piece."],
    example: ["Two identical pizzas.", "Pizza A is cut into 4 slices. Pizza B into 8 slices.", "One slice of A = 1/4. One slice of B = 1/8.", "Put them side by side: two slices of B fit inside one slice of A. So 1/4 = 2/8, and 1/4 > 1/8."],
  },
  hi: {
    standard: ["हर बताता है कि पूरे को कितने बराबर हिस्सों में बाँटा गया है।", "ज़्यादा हिस्से यानी हर हिस्सा छोटा।", "इसलिए अंश समान हो तो बड़े हर वाली भिन्न छोटी होती है: 1/8 < 1/4।"],
    simple: ["एक चॉकलेट सोचिए।", "इसे 4 दोस्तों में बाँटें — सबको बड़ा टुकड़ा मिलता है।", "इसे 8 दोस्तों में बाँटें — सबको छोटा टुकड़ा मिलता है।", "ज़्यादा दोस्त = छोटा टुकड़ा।"],
    example: ["दो एक जैसे पिज़्ज़ा।", "पिज़्ज़ा A के 4 टुकड़े, पिज़्ज़ा B के 8 टुकड़े।", "A का एक टुकड़ा = 1/4। B का एक टुकड़ा = 1/8।", "B के दो टुकड़े A के एक टुकड़े में समा जाते हैं। इसलिए 1/4 = 2/8, और 1/4 > 1/8।"],
  },
  fr: {
    standard: ["Le dénominateur indique en combien de parts égales le tout est partagé.", "Plus il y a de parts, plus chaque part est petite.", "Donc, à numérateur égal, la fraction au plus grand dénominateur est la plus petite : 1/8 < 1/4."],
    simple: ["Imagine une tablette de chocolat.", "Partage-la entre 4 amis — chacun a un gros morceau.", "Partage-la entre 8 amis — chacun a un petit morceau.", "Plus on partage, plus le morceau est petit."],
    example: ["Deux pizzas identiques.", "La pizza A est coupée en 4, la pizza B en 8.", "Une part de A = 1/4. Une part de B = 1/8.", "Deux parts de B tiennent dans une part de A. Donc 1/4 = 2/8, et 1/4 > 1/8."],
  },
};

// ---- language preference (persisted locally, synced across components) ----
const LANG_KEY = "classbridge:lang";
const listeners = new Set<() => void>();
function readLang(): Lang {
  const v = typeof window === "undefined" ? null : window.localStorage.getItem(LANG_KEY);
  return v === "hi" || v === "fr" || v === "en" ? v : "en";
}
export function setLang(lang: Lang) {
  window.localStorage.setItem(LANG_KEY, lang);
  listeners.forEach((l) => l());
}
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    readLang,
    () => "en" as Lang,
  );
}
