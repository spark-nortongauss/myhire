export const themeTokens = {
  radii: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem"
  },
  shadows: {
    card: "0 10px 30px -16px rgba(15, 23, 42, 0.35)",
    glow: "0 0 0 1px rgba(99, 102, 241, 0.25), 0 12px 28px -16px rgba(99, 102, 241, 0.55)"
  },
  typography: {
    display: "clamp(1.8rem, 2.2vw, 2.5rem)",
    h1: "clamp(1.45rem, 1.6vw, 2rem)",
    body: "0.95rem"
  }
} as const;
