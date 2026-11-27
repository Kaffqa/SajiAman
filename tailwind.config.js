/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand & Structural Blues (MBG Civic Identity)
        'mbg-navy': '#0B2E59',
        'mbg-blue': '#0F4C81',
        'mbg-blue-pressed': '#0A355C',
        'mbg-action': '#1D63B8',
        'mbg-tint': '#EBF3FA',
        'mbg-border': '#BDD5EB',

        // Neutrals & Surfaces
        canvas: '#F4F7FA',
        surface: '#FFFFFF',
        'surface-subtle': '#EDF2F7',
        'border-hairline': '#D8E2EC',
        'border-strong': '#94A3B8',
        'ink-primary': '#0F172A',
        'ink-secondary': '#475569',
        'ink-muted': '#64748B',

        // Strict Semantic Food Safety Traffic Lights
        'safety-green': '#15803D',
        'safety-green-soft': '#DCFCE7',
        'safety-green-border': '#86EFAC',
        'safety-green-dark': '#14532D',

        'safety-amber': '#B45309',
        'safety-amber-soft': '#FEF3C7',
        'safety-amber-border': '#FCD34D',
        'safety-amber-dark': '#78350F',

        'safety-red': '#B91C1C',
        'safety-red-soft': '#FEE2E2',
        'safety-red-border': '#FCA5A5',
        'safety-red-dark': '#7F1D1D',

        'eco-teal': '#0F766E',
        'eco-teal-soft': '#CCFBF1',
        'viewfinder-dark': '#0B1220',
        'reticle-blue': '#38BDF8',
      },
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular', 'PlusJakartaSans_500Medium', 'PlusJakartaSans_600SemiBold', 'PlusJakartaSans_700Bold', 'PlusJakartaSans_800ExtraBold', 'System'],
        mono: ['JetBrainsMono_400Regular', 'JetBrainsMono_600SemiBold', 'JetBrainsMono_700Bold', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '10px',
        chip: '8px',
      },
    },
  },
  plugins: [],
};
