import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-muted": "rgb(var(--c-surface-muted) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        "border-strong": "rgb(var(--c-border-strong) / <alpha-value>)",
        teal: {
          DEFAULT: "rgb(var(--c-teal) / <alpha-value>)",
          hover: "rgb(var(--c-teal-hover) / <alpha-value>)",
          light: "rgb(var(--c-teal-light) / <alpha-value>)",
          bright: "rgb(var(--c-teal-bright) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--c-text) / <alpha-value>)",
          muted: "rgb(var(--c-text-muted) / <alpha-value>)",
          faint: "rgb(var(--c-text-faint) / <alpha-value>)",
        },
        chip: {
          bg: "rgb(var(--c-chip-bg) / <alpha-value>)",
          border: "rgb(var(--c-chip-border) / <alpha-value>)",
        },
        examples: "rgb(var(--c-examples) / <alpha-value>)",
        "error-bg": "rgb(var(--c-error-bg) / <alpha-value>)",
        error: "rgb(var(--c-error-text) / <alpha-value>)",
        "warning-bg": "rgb(var(--c-warning-bg) / <alpha-value>)",
        warning: "rgb(var(--c-warning-text) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        sm: "0 1px 2px rgba(20, 30, 30, 0.04)",
        md: "0 4px 12px rgba(20, 30, 30, 0.06)",
      },
      maxWidth: {
        prose: "80ch",
      },
    },
  },
  plugins: [],
};

export default config;
