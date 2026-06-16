import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: "#0F766E",
          tealDark: "#115E59",
          orange: "#F97316",
          orangeDark: "#EA580C",
          charcoal: "#111827",
          muted: "#6B7280"
        }
      },
      boxShadow: {
        soft: "0 8px 30px rgba(17, 24, 39, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
