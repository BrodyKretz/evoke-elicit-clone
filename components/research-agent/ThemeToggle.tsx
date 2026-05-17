"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Light/dark mode toggle. Dark is the default theme. When light mode is active,
// applies the `.light` class on <html>. Theme preference persists to localStorage.

const STORAGE_KEY = "evoke.theme";

type Theme = "light" | "dark";

export function resolveInitialTheme(stored: string | null): Theme {
  return stored === "light" ? "light" : "dark";
}

function read(): Theme {
  if (typeof window === "undefined") return "dark";
  return resolveInitialTheme(window.localStorage.getItem(STORAGE_KEY));
}

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("light", theme === "light");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = read();
    setTheme(initial);
    apply(initial);
    setMounted(true);
  }, []);

  const flip = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  };

  // Avoid hydration mismatch flash — render a neutral placeholder until mounted.
  if (!mounted) {
    return <span className="h-8 w-8" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F3F4F6] dark:border-[#3F3F3F] dark:bg-[#2A2A2A] dark:text-[#ECECEC] dark:hover:bg-[#333333]"
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
