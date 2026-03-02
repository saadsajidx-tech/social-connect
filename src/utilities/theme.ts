export const Colors = {
  // Background layers
  bg: {
    primary: '#08080F',
    secondary: '#0F0F1A',
    tertiary: '#141428',
    card: '#12121E',
    glass: 'rgba(255,255,255,0.04)',
    glassStrong: 'rgba(255,255,255,0.08)',
    overlay: 'rgba(8,8,15,0.85)',
  },

  // Brand
  primary: '#7C3AED',
  primaryLight: '#9D6FFF',
  primaryDark: '#5B21B6',
  primaryGlow: 'rgba(124,58,237,0.3)',

  accent: '#00E5C3',
  accentLight: '#4DFFD8',
  accentDark: '#00B89C',
  accentGlow: 'rgba(0,229,195,0.25)',

  // Gradients (start/end pairs)
  gradients: {
    primary: ['#7C3AED', '#A855F7'],
    accent: ['#00E5C3', '#0EA5E9'],
    card: ['#12121E', '#1A1A2E'],
    night: ['#08080F', '#0F0F1A'],
    fire: ['#F59E0B', '#EF4444'],
    aurora: ['#7C3AED', '#00E5C3'],
  },

  // Text
  text: {
    primary: '#F0F0FF',
    secondary: '#A0A0C0',
    tertiary: '#606080',
    inverse: '#08080F',
    accent: '#00E5C3',
    brand: '#9D6FFF',
  },

  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Border
  border: {
    subtle: 'rgba(255,255,255,0.06)',
    medium: 'rgba(255,255,255,0.10)',
    strong: 'rgba(255,255,255,0.16)',
    brand: 'rgba(124,58,237,0.4)',
    accent: 'rgba(0,229,195,0.3)',
  },

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const Typography = {
  display: {
    fontSize: 36,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    lineHeight: 44,
    color: Colors.text.primary,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
    lineHeight: 36,
    color: Colors.text.primary,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 28,
    color: Colors.text.primary,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    lineHeight: 24,
    color: Colors.text.primary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: Colors.text.secondary,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: Colors.text.primary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: Colors.text.tertiary,
    letterSpacing: 0.2,
  },
  captionBold: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    color: Colors.text.secondary,
    letterSpacing: 0.4,
  },
  overline: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: Colors.text.tertiary,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const Shadow = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  brand: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  accent: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
};
