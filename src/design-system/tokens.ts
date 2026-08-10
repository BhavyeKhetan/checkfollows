/**
 * Ramp Design System Tokens
 * Matched EXACTLY to https://ramp.com/ (Extracted pixel hex: #E7F256)
 */

export const rampColors = {
  // Exact Ramp Yellow (#E7F256)
  lime: {
    DEFAULT: "#E7F256",
    hover: "#DAE64A",
    active: "#C7D337",
    light: "#F8FCDB",
    subtle: "rgba(231, 242, 86, 0.25)",
    border: "rgba(215, 225, 60, 0.5)",
    glow: "rgba(231, 242, 86, 0.45)",
  },

  // Ramp Dark Obsidian Accents (Logo, Black Buttons, Primary Text)
  dark: {
    DEFAULT: "#121212",
    hover: "#262626",
    active: "#000000",
    muted: "#333333",
  },

  // Light Backgrounds & Surfaces (Matching Ramp.com)
  light: {
    bg: "#FFFFFF",
    bgSubtle: "#F9F9F7",
    surface: "#FFFFFF",
    surfaceHover: "#FAFAFA",
    elevated: "#FFFFFF",
    input: "#FFFFFF",
    badge: "#EDEDE8",
  },

  // Borders
  border: {
    subtle: "#F0F0ED",
    default: "#E2E2DC",
    hover: "#D0D0CA",
    dark: "#121212",
    lime: "#DAE64A",
  },

  // Text Hierarchy
  text: {
    primary: "#121212",
    secondary: "#555555",
    tertiary: "#777777",
    muted: "#888888",
    inverse: "#FFFFFF",
    inverseDark: "#121212",
  },

  // Status Tokens
  status: {
    success: {
      DEFAULT: "#10B981",
      subtle: "#E6F4EA",
      border: "#A7F3D0",
      text: "#047857",
    },
    warning: {
      DEFAULT: "#F59E0B",
      subtle: "#FEF3C7",
      border: "#FDE68A",
      text: "#B45309",
    },
    danger: {
      DEFAULT: "#EF4444",
      subtle: "#FEE2E2",
      border: "#FCA5A5",
      text: "#B91C1C",
    },
    info: {
      DEFAULT: "#0EA5E9",
      subtle: "#E0F2FE",
      border: "#BAE6FD",
      text: "#0369A1",
    },
  },
} as const;

export const rampRadius = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

export const rampShadows = {
  sm: "0 1px 3px rgba(0, 0, 0, 0.05)",
  md: "0 4px 16px rgba(0, 0, 0, 0.06)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.08)",
  limeGlow: "0 4px 20px rgba(231, 242, 86, 0.4)",
  cardInset: "inset 0 1px 0 0 rgba(255, 255, 255, 0.8)",
} as const;

export const rampTransitions = {
  fast: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
  default: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  smooth: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
} as const;
