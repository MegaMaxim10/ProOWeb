/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./ProOWeb/public/**/*.html",
    "./ProOWeb/public/assets/js/**/*.js",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Aptos", '"Segoe UI"', "sans-serif"],
        mono: ['"IBM Plex Mono"', '"Cascadia Code"', "Consolas", "monospace"],
      },
      colors: {
        pw: {
          bg: "#edf2f7",
          bga: "#d7ebe3",
          panel: "#ffffff",
          soft: "#f8fbff",
          text: "#122234",
          muted: "#4d5f72",
          line: "#c7d5e3",
          action: "#136e59",
          "action-h": "#0d5343",
          focus: "#2a78c4",
          surface: "#e9f3ff",
          "surface-s": "#eff8f4",
          success: "#127749",
          error: "#b42318",
        },
        "pw-d": {
          bg: "#0d1420",
          bga: "#142136",
          panel: "#111c2c",
          soft: "#162538",
          text: "#d9e7f8",
          muted: "#8fa8c6",
          line: "#2c3f57",
          action: "#26a881",
          "action-h": "#1f8a6a",
          focus: "#61b5ff",
          surface: "#17314f",
          "surface-s": "#19372f",
          success: "#4ac08f",
          error: "#ff6d6d",
        },
      },
    },
  },
  plugins: [],
};
