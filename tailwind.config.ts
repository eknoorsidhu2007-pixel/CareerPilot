import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        bg2: "#111111",
        bg3: "#171717",
        card: "#1A1A1A",
        card2: "#202020",
        border: "#2A2A2A",
        text: "#F5F5F5",
        muted: "#A1A1AA",
        blue: "#3B82F6",
        green: "#10B981",
        amber: "#F59E0B",
        red: "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
      borderRadius: {
        lg: "12px",
        xl: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
