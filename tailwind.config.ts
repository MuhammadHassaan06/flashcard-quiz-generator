import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12121A",
        paper: "#FAF9F6",
        accent: "#5B5BD6",
        accent2: "#E8664B",
        muted: "#8A8A9A",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      perspective: {
        "1000": "1000px",
      },
    },
  },
  plugins: [],
};

export default config;