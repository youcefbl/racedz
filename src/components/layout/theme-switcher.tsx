"use client";

import { Check, Moon, Sparkles, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMenuKeyboard } from "@/components/layout/use-menu-keyboard";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "race", label: "Race (neon)", icon: Sparkles }
] as const;

type ThemeMode = (typeof THEMES)[number]["value"];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { onKeyDown } = useMenuKeyboard({ open, setOpen, menuRef, triggerRef });
  const selectedTheme = THEMES.find((item) => item.value === theme) ?? THEMES[0];
  const SelectedIcon = selectedTheme.icon;

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("racedz-theme");
    const initialTheme = isThemeMode(savedTheme) ? savedTheme : "light";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    setOpen(false);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("racedz-theme", nextTheme);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Theme: ${selectedTheme.label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Theme: ${selectedTheme.label}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm transition hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
      >
        <SelectedIcon className="size-[18px]" aria-hidden="true" />
      </button>

      {open ? <div className="rz-pop-scrim" aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <div
          className="rz-pop absolute end-0 top-12 z-50 w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-soft"
          role="menu"
          aria-label={`Theme: ${selectedTheme.label}`}
          onKeyDown={onKeyDown}
        >
          {THEMES.map((item) => (
            <ThemeMenuItem
              key={item.value}
              label={item.label}
              icon={item.icon}
              active={theme === item.value}
              onClick={() => selectTheme(item.value)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ThemeMenuItem({
  label,
  icon: Icon,
  active,
  onClick
}: {
  label: string;
  icon: typeof Sun;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
        active ? "bg-[var(--primary-soft)] text-brand-teal" : "text-[var(--text)] hover:bg-[var(--surface-soft)]"
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </span>
      {active ? <Check className="size-4" aria-hidden="true" /> : null}
    </button>
  );
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "race";
}
