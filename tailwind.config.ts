import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: { gb: "#7ec8ff" },
        grass: { gb: "#76c043" },
        sun: { gb: "#ffd23f" },
        wood: { gb: "#c9893b" },
        stone: { gb: "#9aa0a6" },
        ice: { gb: "#bfeaff" },
        bird: {
          red: "#ef3a3a",
          yellow: "#ffd23f",
          blue: "#3aa7ef",
          black: "#222831",
          green: "#5fcf52",
          white: "#f6f4ee",
          purple: "#8b5cf6",
        },
      },
      fontFamily: { display: ["system-ui", "ui-rounded", "sans-serif"] },
      boxShadow: { juicy: "0 8px 0 rgba(0,0,0,0.18), 0 12px 24px rgba(0,0,0,0.18)" },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        pop: { "0%": { transform: "scale(0.7)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: { floaty: "floaty 3s ease-in-out infinite", pop: "pop 240ms ease-out" },
    },
  },
  plugins: [],
} satisfies Config;
