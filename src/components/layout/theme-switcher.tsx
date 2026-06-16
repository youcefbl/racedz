"use client";

import { Moon, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "race", label: "Race", icon: Sparkles }
] as const;

type ThemeMode = (typeof THEMES)[number]["value"];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("racedz-theme");
    const initialTheme = isThemeMode(savedTheme) ? savedTheme : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  function selectTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("racedz-theme", nextTheme);
  }

  return (
    <div className="flex rounded-lg border border-gray-200 bg-white p-1" aria-label="Theme selector">
      {THEMES.map((item) => (
        <button
          key={item.value}
          type="button"
          title={item.label}
          aria-label={`${item.label} mode`}
          aria-pressed={theme === item.value}
          onClick={() => selectTheme(item.value)}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
            theme === item.value ? "bg-brand-orange text-white" : "text-gray-600 hover:bg-gray-100"
          )}
        >
          <item.icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "race";
}
