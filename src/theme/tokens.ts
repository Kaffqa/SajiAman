/**
 * SajiAman Design System Tokens
 * Single source of truth directly portable to NativeWind tailwind.config.js.
 */

export const COLORS = {
  // Brand & Structural Blues (MBG Civic Identity)
  mbgNavy: '#0B2E59',
  mbgBlue: '#0F4C81',
  mbgBluePressed: '#0A355C',
  mbgAction: '#1D63B8',
  mbgBlueTint: '#EBF3FA',
  mbgBlueBorder: '#BDD5EB',

  // Neutrals & Surfaces
  canvas: '#F4F7FA',
  surface: '#FFFFFF',
  surfaceSubtle: '#EDF2F7',
  borderHairline: '#D8E2EC',
  borderStrong: '#94A3B8',
  inkPrimary: '#0F172A',
  inkSecondary: '#475569',
  inkMuted: '#64748B',

  // Strict Semantic Food Safety Traffic Lights
  safetyGreen: '#15803D',
  safetyGreenSoft: '#DCFCE7',
  safetyGreenBorder: '#86EFAC',
  safetyGreenDark: '#14532D',

  safetyAmber: '#B45309',
  safetyAmberSoft: '#FEF3C7',
  safetyAmberBorder: '#FCD34D',
  safetyAmberDark: '#78350F',

  safetyRed: '#B91C1C',
  safetyRedSoft: '#FEE2E2',
  safetyRedBorder: '#FCA5A5',
  safetyRedDark: '#7F1D1D',

  ecoTeal: '#0F766E',
  ecoTealSoft: '#CCFBF1',

  viewfinderDark: '#0B1220',
  reticleBlue: '#38BDF8',
} as const;

export const RADII = {
  card: 12,
  button: 10,
  input: 10,
  chip: 8,
  tag: 6,
} as const;

export const SPACING = {
  gutter: 16,
  sectionGap: 16,
  minTouchTarget: 48,
  ctaHeight: 52,
  tabBarHeight: 64,
} as const;
