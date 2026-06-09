// Northeastern University Brand Colors
// Source: northeastern.edu website

export const COLORS = {
  // Brand
  red: "#D41B2C",
  black: "#000000",
  white: "#FFFFFF",

  // Text
  textPrimary: "#000000",
  textSecondary: "#7C7B7B",
  textLight: "#ABABAB",
  textOnRed: "#FFFFFF",
  textOnBlack: "#FFFFFF",

  // Surfaces
  background: "#FFFFFF",
  backgroundAlt: "#F7F7F7",
  surface: "#FFFFFF",
  divider: "#E8E8E8",

  // Status
  success: "#2D8C4E",
  warning: "#E8A317",
  error: "#D41B2C",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

export const FONT_SIZE = {
  caption: 11,
  small: 13,
  body: 15,
  large: 17,
  title: 22,
  heading: 28,
  hero: 34,
};

export const FONT_WEIGHT = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  black: "900" as const,
};

// Minimal shadows — NU site is nearly flat
export const SHADOWS = {
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};