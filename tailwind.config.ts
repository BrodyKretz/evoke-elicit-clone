import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F5F2EA",
        surface: "#FFFFFF",
        "surface-muted": "#FAF8F2",
        border: "#E5E1D6",
        "border-strong": "#D4CFC0",
        teal: {
          DEFAULT: "#0F5C5C",
          hover: "#0A4A4A",
          light: "#E8F0EE",
        },
        text: {
          DEFAULT: "#1A1F1F",
          muted: "#6B7270",
          faint: "#9CA09C",
        },
        chip: {
          bg: "#F0EDE3",
          border: "#E0DCCE",
        },
        examples: "#DDE3DE",
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
