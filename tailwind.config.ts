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
          // ZidRun identity: primary green + orange accent.
          // (key names kept as `teal`/`orange` to preserve existing class usage)
          teal: "#15803D",
          tealDark: "#166534",
          orange: "#F47A20",
          orangeDark: "#EA580C",
          // Darker orange reserved for text on light orange tints (AA: 4.9:1 on orange-50).
          orangeText: "#C2410C",
          charcoal: "#111827",
          muted: "#6B7280"
        }
      },
      boxShadow: {
        soft: "0 8px 30px rgba(17, 24, 39, 0.08)"
      },
      // Keep the whole UI light and simple: cap every "heavy" weight utility at
      // semibold (600). The codebase uses font-bold/extrabold/black liberally; this
      // makes all of them render 600 so nothing reads chunky. Body stays 400.
      fontWeight: {
        medium: "500",
        semibold: "600",
        bold: "600",
        extrabold: "600",
        black: "600"
      }
    }
  },
  plugins: []
};

export default config;
