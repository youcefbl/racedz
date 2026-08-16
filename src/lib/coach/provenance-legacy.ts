import type { DataGapKey, ProvenanceKey } from "@/lib/coach/provenance";

/**
 * Localized provenance copy this product has ALREADY WRITTEN INTO STORED INTERACTIONS.
 *
 * `enforceCoachSafety` localizes `usedSignals`/`dataGaps` before persisting, so a `CoachInteraction`
 * row holds sentences, not keys. Every time that copy is rewritten, the phrasings already sitting in
 * the database stop matching the current table — and the native reply card, which resolves stored
 * prose back to a key before rendering its own localized label, silently loses the whole "Why this
 * advice?" block for the runner's entire history.
 *
 * So superseded copy is retired to here rather than deleted. Nothing in this file is ever RENDERED:
 * it exists only so `resolveProvenanceKey`/`resolveDataGapKey` can still recognise an old row.
 *
 * Kept out of `provenance.ts` on purpose. `scripts/check-native-i18n.ts` runs the Algiers-Darija
 * drift gate over that file, and these strings are exactly the pre-Darija forms the gate exists to
 * reject (`قدّاش`, MSA `الطقس`, the gendered `سقسيتي`/`عطيتيها`). They are history, not copy, and a
 * historical record must not be edited to satisfy a rule written after it.
 *
 * When copy changes again: move the outgoing strings here, do not remove what is already here.
 */

type Superseded = { key: ProvenanceKey | DataGapKey; phrases: string[] };

export const SUPERSEDED_PROVENANCE_COPY: Superseded[] = [
  // --- Generation 1 (`fa58dfc`, COACH-F4/F6): short label-style copy, before the vocabulary was
  // closed. English was the alias key itself, so only fr/ar phrasings are recorded here.
  { key: "GOAL", phrases: ["objectif", "الهدف"] },
  { key: "ACTIVE_PLAN", phrases: ["plan en cours", "البرنامج الحالي"] },
  { key: "RECENT_RUNS", phrases: ["sorties récentes", "الجريات الأخيرة", "allure récente", "الوتيرة الأخيرة"] },
  { key: "PLAN_ADHERENCE", phrases: ["assiduité", "الانتظام"] },
  { key: "CONSISTENCY", phrases: ["régularité", "المواظبة"] },
  { key: "SLEEP", phrases: ["sommeil", "النوم"] },
  { key: "WEATHER", phrases: ["météo", "الطقس"] },
  { key: "ANALYSED_RUN", phrases: ["sortie analysée", "الجرية المحلَّلة"] },
  { key: "HEALTH_CONTEXT", phrases: ["problème de santé chronique", "حالة صحية مزمنة"] },
  { key: "RUNNER_QUESTION", phrases: ["question du coureur", "سؤال العدّاء"] },
  { key: "SAFETY_DECISION", phrases: ["décision de sécurité", "قرار السلامة"] },
  { key: "COACH_MEMORY", phrases: ["mémoire du coach", "ذاكرة المدرب"] },
  { key: "NO_HEALTH_DETAILS", phrases: ["aucun détail sur le problème cardiaque", "ما كاش تفاصيل على الحالة القلبية"] },

  // --- Generation 2 (`b6394aa`, closed vocabulary): full-sentence copy. Only the Arabic changed in
  // generation 3 (`1eb0782`, gender-neutral Darija), so only Arabic is recorded.
  { key: "PLAN_ADHERENCE", phrases: ["قدّاش تبعتي البرنامج"] },
  { key: "ANALYSED_RUN", phrases: ["الجرية اللي سقسيتي عليها"] },
  { key: "HEALTH_CONTEXT", phrases: ["المعلومات الصحية اللي عطيتيها"] },
  { key: "SAFETY_DECISION", phrases: ["تحقّق تاع السلامة"] },
  { key: "COACH_MEMORY", phrases: ["واش فاكرو المدرب"] },
  { key: "NO_RECENT_PACE", phrases: ["ما كاش وتيرة أخيرة"] },
  { key: "NO_WEATHER_DATA", phrases: ["ما كاش معطيات الطقس"] },
];
