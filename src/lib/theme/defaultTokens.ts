export type TokenMap = Record<string, string>;

// Base tokens that back all themes. Keys already include the CSS variable
// prefix `--` so applyTheme can set them directly.
export const defaultTokens: TokenMap = {
  // Colors & background
  '--bg': '#0b1021',
  '--bg-alt': '#0b1021',
  '--bg-secondary': '#11172a',
  '--bg-hover': 'rgba(255, 255, 255, 0.06)',
  '--bg-gradient':
    'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 35%), linear-gradient(145deg, #0b1021, #080b17)',
  '--surface-0': 'rgba(255, 255, 255, 0.06)',
  '--surface-1': 'rgba(255, 255, 255, 0.04)',

  // Text
  '--text': '#e9eefc',
  '--text-strong': '#ffffff',
  '--text-secondary': '#c0c6dd',
  '--text-muted': '#8a90a8',

  // Accents
  '--accent': '#7ce7ff',
  '--accent-2': '#3fb3f2',
  '--accent-3': 'rgba(124, 231, 255, 0.7)',
  '--accent-warning': '#ffc857',
  '--accent-danger': '#ff6b6b',
  '--accent-secondary': '#3fb3f2',
  '--accent-light': 'rgba(124, 231, 255, 0.16)',

  // Lines & surfaces
  '--border': 'rgba(255, 255, 255, 0.12)',
  '--border-light': 'rgba(255, 255, 255, 0.08)',
  '--glass-border': 'rgba(255, 255, 255, 0.08)',
  '--card-bg': 'rgba(255, 255, 255, 0.06)',
  '--card-border': 'rgba(255, 255, 255, 0.18)',
  '--card-shadow': '0 16px 45px rgba(7, 9, 26, 0.35)',
  '--modal-bg': 'rgba(10, 14, 30, 0.92)',
  '--modal-shadow': '0 30px 70px rgba(6, 8, 24, 0.55)',
  '--modal-backdrop': 'rgba(4, 6, 20, 0.65)',
  '--sidebar-bg': 'rgba(255, 255, 255, 0.04)',
  '--sidebar-border': 'rgba(255, 255, 255, 0.12)',
  '--topbar-bg': 'rgba(255, 255, 255, 0.06)',
  '--topbar-border': 'rgba(255, 255, 255, 0.12)',
  '--grid-line': 'rgba(255, 255, 255, 0.08)',
  '--button-bg': 'rgba(255, 255, 255, 0.08)',
  '--button-hover': 'rgba(255, 255, 255, 0.16)',
  '--button-active': 'rgba(63, 179, 242, 0.25)',
  '--button-text': '#e9eefc',

  // Radii
  '--radius-xs': '6px',
  '--radius-sm': '10px',
  '--radius-md': '14px',
  '--radius-lg': '22px',

  // Shadows
  '--shadow-xs': '0 6px 18px rgba(5, 7, 20, 0.15)',
  '--shadow-sm': '0 10px 26px rgba(5, 7, 20, 0.18)',
  '--shadow-md': '0 18px 40px rgba(4, 6, 18, 0.25)',
  '--shadow-lg': '0 30px 70px rgba(3, 5, 16, 0.35)',
  '--shadow-xl': '0 40px 90px rgba(3, 5, 16, 0.45)',

  // Spacing
  '--spacing-2xs': '4px',
  '--spacing-xs': '6px',
  '--spacing-sm': '10px',
  '--spacing-md': '14px',
  '--spacing-lg': '18px',
  '--spacing-xl': '26px',
  '--spacing-2xl': '34px',
  '--space-xs': '6px',
  '--space-sm': '12px',
  '--space-md': '18px',
  '--space-lg': '28px',

  // Misc layout tokens
  '--blur': '14px',
  '--sidebar-width': '400px',
  '--topbar-height': '76px',
  '--font-family': "'Space Grotesk', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  '--font-size-xs': '12px',
  '--font-size-sm': '14px',
  '--font-size-base': '16px',
  '--font-size-lg': '18px',
  '--font-size-xl': '22px',
  '--font-size-2xl': '30px',
  '--font-weight-normal': '400',
  '--font-weight-medium': '500',
  '--font-weight-semibold': '600',
  '--font-weight-bold': '700',
  '--animation-duration': '200ms',
  '--animation-easing': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
};
