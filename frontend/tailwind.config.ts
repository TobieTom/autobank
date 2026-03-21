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
        bg:             "#08080F",
        surface:        "#0F0F1A",
        "surface-raised": "#141420",
        border:         "#1E1E2E",
        accent:         "#00D4FF",
        success:        "#00FF94",
        warning:        "#FFB800",
        danger:         "#FF4560",
        "text-primary": "#F0F0FF",
        "text-secondary": "#8888AA",
      },
      fontFamily: {
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
        body:    ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-jetbrains-mono)", "Courier New", "monospace"],
      },
      boxShadow: {
        "glow-accent":  "0 0 12px rgba(0, 212, 255, 0.6), 0 0 40px rgba(0, 212, 255, 0.2)",
        "glow-success": "0 0 12px rgba(0, 255, 148, 0.6), 0 0 40px rgba(0, 255, 148, 0.2)",
        "glow-danger":  "0 0 12px rgba(255, 69, 96, 0.6),  0 0 40px rgba(255, 69, 96, 0.2)",
      },
      animation: {
        "cursor-blink": "cursor-blink 1s step-end infinite",
        "scanline":     "scanline 8s linear infinite",
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      backgroundImage: {
        "grid-accent": `linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)`,
      },
      backgroundSize: {
        "grid-40": "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
