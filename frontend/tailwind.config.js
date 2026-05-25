/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F2A44",
        muted: "#667085",
        line: "#E5E0D8",
        accent: "#F69D39",
        risk: "#D92243",
        warning: "#E0C375",
        warm: "#FFF5E5",
        surface: "#FFF9EE"
      },
      boxShadow: {
        panel: "0 18px 48px rgba(31, 42, 68, 0.08)",
        soft: "0 10px 28px rgba(31, 42, 68, 0.06)"
      }
    }
  },
  plugins: []
};
