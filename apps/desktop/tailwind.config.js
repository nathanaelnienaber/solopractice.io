/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        accent: "var(--accent)",
        destructive: "var(--destructive)",
        success: "var(--success)",
        warning: "var(--warning)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        ring: "var(--ring)",
        overlay: "var(--overlay)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      boxShadow: {
        dialog:
          "0 10px 40px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border)",
      },
    },
  },
  plugins: [],
};
