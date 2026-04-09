import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          green: "#c8f060",
        },
        teal: {
          DEFAULT: "#7dd3b0",
        },
        amber: {
          rank: "#f0b860",
        },
        coral: {
          DEFAULT: "#f07060",
        },
        purple: {
          rank: "#a78bfa",
        },
        surface: "#16181c",
        surface2: "#1e2026",
        background: "#0e0f11",
        border: "#2a2d35",
        foreground: "#e8e9eb",
        muted: "#6b7280",
        "nav-active": "#1e2026",
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        serif: ['"Instrument Serif"', "serif"],
      },
      keyframes: {
        skeleton: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        skeleton: "skeleton 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
