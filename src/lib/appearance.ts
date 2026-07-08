// Shared helpers for the runner's saved UI preferences (language + theme). Pure functions,
// safe to import from both client and server. The persisted values sync across devices via
// the User.language / User.theme columns and the racedz-locale / racedz-theme cookies.

export const LOCALE_COOKIE = "racedz-locale";
export const THEME_COOKIE = "racedz-theme";
export const APPEARANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const THEMES = ["light", "dark", "race"] as const;
const LOCALES = ["en", "fr", "ar"] as const;

export type AppearanceTheme = (typeof THEMES)[number];
export type AppearanceLocale = (typeof LOCALES)[number];

export function normalizeTheme(value: unknown): AppearanceTheme | null {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value)
    ? (value as AppearanceTheme)
    : null;
}

export function normalizeLocale(value: unknown): AppearanceLocale | null {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
    ? (value as AppearanceLocale)
    : null;
}
