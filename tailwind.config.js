/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: "#22C55E",

        // Neutral zinc — no color tint, maximum legibility
        gray: {
          50:  "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",  // secondary text
          500: "#71717A",  // muted text / icons
          600: "#52525B",  // deeper muted
          700: "#3F3F46",  // borders
          800: "#27272A",  // elevated surfaces, odds chips
          850: "#1C1C1F",  // card backgrounds
          900: "#18181B",  // headers / tab bar / nav
          950: "#09090B",  // screen backgrounds
        },

        green: {
          300: "#86EFAC",
          400: "#4ADE80",  // Signal Green — positive values
          500: "#22C55E",  // Win Green — CTAs, active states, wins
          600: "#16A34A",  // Deep Green — pressed, confident accents
          700: "#15803D",
        },

        indigo: {
          400: "#818CF8",
          500: "#6366F1",  // AI-generated content
          600: "#4F46E5",
        },
      },
    },
  },
  plugins: [],
};
