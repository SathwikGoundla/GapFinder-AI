import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F6F2",
        surface: "#FFFFFF",
        line: "#E4E1D8",
        ink: { DEFAULT: "#1A2240", soft: "#4A5170", faint: "#7A8098" },
        accent: { DEFAULT: "#4A45C4", hover: "#3C37A8", tint: "#ECEBFA" },
        weak: { DEFAULT: "#B4372F", tint: "#FBECEA" },
        developing: { DEFAULT: "#A86B12", tint: "#FBF2E2" },
        strong: { DEFAULT: "#2F7D5B", tint: "#E7F4EE" },
        unknown: { DEFAULT: "#6B7280", tint: "#F1F1F3" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["ui-serif", "Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia", "serif"],
      },
      borderRadius: { sm: "4px", DEFAULT: "6px", lg: "10px" },
      boxShadow: { lift: "0 1px 2px rgba(26,34,64,.06), 0 4px 12px -6px rgba(26,34,64,.12)" },
    },
  },
  plugins: [],
} satisfies Config;
