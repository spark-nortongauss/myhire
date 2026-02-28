import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(220 26% 14%)",
        primary: {
          DEFAULT: "hsl(244 74% 58%)",
          foreground: "hsl(0 0% 100%)"
        },
        muted: {
          DEFAULT: "hsl(214 32% 96%)",
          foreground: "hsl(220 9% 46%)"
        },
        danger: "hsl(0 84% 60%)"
      }
    }
  },
  plugins: []
};

export default config;
