import type { Locale } from "@/lib/i18n";

export const ROAD_RECORDS_REVIEWED_AT = "2026-07-29";

export type RoadRecordRow = {
  distance: Record<Locale, string>;
  men: Record<Locale, string>;
  women: Record<Locale, string>;
};

export const ROAD_RECORDS: RoadRecordRow[] = [
  {
    distance: { en: "5K road", fr: "5 km route", ar: "5 كلم طريق" },
    men: { en: "12:49 — Berihu Aregawi", fr: "12:49 — Berihu Aregawi", ar: "12:49 — Berihu Aregawi" },
    women: {
      en: "13:54 — Beatrice Chebet (mixed race)",
      fr: "13:54 — Beatrice Chebet (course mixte)",
      ar: "13:54 — Beatrice Chebet (سباق مختلط)"
    }
  },
  {
    distance: { en: "10K road", fr: "10 km route", ar: "10 كلم طريق" },
    men: { en: "26:31 — Yomif Kejelcha", fr: "26:31 — Yomif Kejelcha", ar: "26:31 — Yomif Kejelcha" },
    women: {
      en: "28:46 — Agnes Ngetich (mixed race)",
      fr: "28:46 — Agnes Ngetich (course mixte)",
      ar: "28:46 — Agnes Ngetich (سباق مختلط)"
    }
  },
  {
    distance: { en: "Half marathon", fr: "Semi-marathon", ar: "نصف الماراثون" },
    men: { en: "57:20 — Jacob Kiplimo", fr: "57:20 — Jacob Kiplimo", ar: "57:20 — Jacob Kiplimo" },
    women: { en: "1:02:52 — Letesenbet Gidey", fr: "1:02:52 — Letesenbet Gidey", ar: "1:02:52 — Letesenbet Gidey" }
  },
  {
    distance: { en: "Marathon", fr: "Marathon", ar: "الماراثون" },
    men: {
      en: "1:59:30 — Sabastian Sawe (pending ratification)",
      fr: "1:59:30 — Sabastian Sawe (ratification en attente)",
      ar: "1:59:30 — Sabastian Sawe (بانتظار التصديق)"
    },
    women: { en: "2:09:56 — Ruth Chepngetich", fr: "2:09:56 — Ruth Chepngetich", ar: "2:09:56 — Ruth Chepngetich" }
  }
];

export const ROAD_RECORD_SOURCES = [
  {
    href: "https://worldathletics.org/records/by-discipline/road-running",
    label: {
      en: "World Athletics road-running records",
      fr: "Records de course sur route de World Athletics",
      ar: "أرقام الاتحاد الدولي لألعاب القوى على الطريق"
    }
  },
  {
    href: "https://worldathletics.org/news/press-releases/ratified-world-records-hoey-kejelcha-yamanishi",
    label: {
      en: "World Athletics: Kejelcha 10K record ratification",
      fr: "World Athletics : ratification du record du 10 km de Kejelcha",
      ar: "الاتحاد الدولي: التصديق على رقم كييلشا في 10 كلم"
    }
  },
  {
    href: "https://worldathletics.org/news/report/jacob-kiplimo-half-marathon-world-record-lisbon",
    label: {
      en: "World Athletics: Kiplimo half-marathon record report",
      fr: "World Athletics : record du semi-marathon de Kiplimo",
      ar: "الاتحاد الدولي: تقرير رقم كيبليمو في نصف الماراثون"
    }
  },
  {
    href: "https://worldathletics.org/news/report/sawe-two-hour-assefa-world-record-london-marathon",
    label: {
      en: "World Athletics: Sawe marathon record report",
      fr: "World Athletics : record du marathon de Sawe",
      ar: "الاتحاد الدولي: تقرير رقم ساوي في الماراثون"
    }
  }
] as const;
