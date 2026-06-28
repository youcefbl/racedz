import type { CoachResponse } from "@/lib/coach/schemas";

/**
 * Lightweight, deterministic on-topic check for free-text coach questions.
 *
 * The AI coach should only answer running / training / recovery questions. This pre-filter
 * catches clearly off-topic messages before any paid model call. The system prompt is the
 * second line of defence for anything subtle that slips through.
 */

// Broad multilingual running / training / recovery vocabulary (EN / FR / AR).
const onTopicPatterns: RegExp[] = [
  // English
  /\b(run(?:ning|ner|s)?|jog|race|races|racing|marathon|half[- ]?marathon|sprint|pace|paces|tempo|interval|fartlek|stride|cadence|split|negative split|taper|warm[- ]?up|cool[- ]?down|cross[- ]?train|treadmill|track|trail|5k|10k|21k|42k|km|kilomet|mile|long run|easy run|recovery|rest day|workout|training|train|plan|fitness|endurance|stamina|vo2|heart rate|hr zone|effort|fatigue|injur|knee|shin|calf|hamstring|achilles|plantar|ankle|hip|cramp|blister|stretch|mobility|hydrat|nutrition|fuel|gel|carb|protein|electrolyte|shoe|trainers|sweat|breath)/i,
  // French
  /\b(cour(?:ir|se|ses|eur)|jogging|allure|rythme|fractionn|seuil|sortie longue|récupération|échauffement|entra[iî]nement|s[ée]ance|plan|endurance|blessure|genou|mollet|tendon|cheville|hanche|étirement|hydrat|nutrition|foul[ée]e|cadence|fréquence cardiaque|fatigue|marathon|trail|piste|tapis)/i,
  // Arabic
  /(جري|الجري|ركض|الركض|سباق|ماراثون|وتيرة|إيقاع|تدريب|حصة|خطة|تحمل|إصابة|ركبة|عضلة|كاحل|إطالة|إحماء|استشفاء|تغذية|ترطيب|نبض|تعب|مسافة|كيلومتر|هرولة)/
];

export function evaluateTopicality(message: string | null | undefined): { onTopic: boolean } {
  const text = (message ?? "").trim();
  // Very short or empty messages can't be reliably classified; let them through.
  if (text.length < 6) return { onTopic: true };
  return { onTopic: onTopicPatterns.some((pattern) => pattern.test(text)) };
}

export function buildOffTopicCoachResponse(locale: "en" | "fr" | "ar"): CoachResponse {
  const copy = {
    en: "I'm your ZidRun running coach, so I can only help with running, training, recovery, and race preparation. Ask me about your runs, your plan, or how to train for your goal.",
    fr: "Je suis votre coach de course ZidRun : je ne peux aider que pour la course, l'entraînement, la récupération et la préparation aux courses. Posez-moi une question sur vos sorties, votre plan ou votre objectif.",
    ar: "أنا مدرب الجري الخاص بك في ZidRun، لذا يمكنني المساعدة فقط في الجري والتدريب والاستشفاء والتحضير للسباقات. اسألني عن حصصك أو خطتك أو هدفك."
  }[locale];

  return {
    summary: copy,
    progressAssessment: copy,
    positiveSignals: [],
    warningSignals: [],
    nextWorkout: null,
    upcomingWorkouts: [],
    recoveryAdvice: [],
    requiresProfessionalAdvice: false
  };
}
