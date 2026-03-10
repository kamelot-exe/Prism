export interface Theme {
  name: string;
  description?: string;
  bg: string;
  'bg-secondary': string;
  'bg-hover': string;
  text: string;
  'text-secondary': string;
  'text-muted'?: string;
  accent: string;
  'accent-secondary': string;
  'accent-light'?: string;
  border: string;
  'border-light'?: string;
  'card-bg': string;
  'card-border': string;
  'card-shadow': string;
  'modal-bg': string;
  'modal-shadow': string;
  'modal-backdrop'?: string;
  'sidebar-bg': string;
  'sidebar-border': string;
  'topbar-bg': string;
  'topbar-border': string;
  'grid-line': string;
  'button-bg': string;
  'button-hover': string;
  'button-active': string;
  'button-text': string;
  'radius-sm': string;
  'radius-md': string;
  'radius-lg': string;
  'shadow-xs'?: string;
  'shadow-sm': string;
  'shadow-md': string;
  'shadow-lg': string;
  blur?: string;
  'background-gradient'?: string;
}

export type ThemeName =
  | 'glassmorphism'
  | 'aurora-neon'
  | 'claymorphism-soft'
  | 'cyber-minimal-grid'
  | 'sunset-fade'
  | 'blueprint-technical';

export async function loadTheme(themeName: ThemeName): Promise<Theme> {
  try {
    const response = await fetch(`/themes/${themeName}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load theme: ${themeName}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading theme ${themeName}:`, error);
    try {
      const fallback = await fetch('/themes/glassmorphism.json');
      return await fallback.json();
    } catch (fallbackError) {
      console.error('Failed to load fallback theme:', fallbackError);
      return getDefaultTheme();
    }
  }
}

function getDefaultTheme(): Theme {
  return {
    name: 'Glassmorphism',
    bg: '#0f172a',
    'bg-secondary': 'rgba(255,255,255,0.06)',
    'bg-hover': 'rgba(255,255,255,0.12)',
    text: '#e2e8f0',
    'text-secondary': '#cbd5e1',
    'text-muted': '#94a3b8',
    accent: '#7dd3fc',
    'accent-secondary': '#38bdf8',
    'accent-light': 'rgba(125, 211, 252, 0.25)',
    border: 'rgba(255,255,255,0.18)',
    'border-light': 'rgba(255,255,255,0.12)',
    'card-bg': 'rgba(255,255,255,0.08)',
    'card-border': 'rgba(255,255,255,0.22)',
    'card-shadow': '0 20px 60px rgba(15, 23, 42, 0.45)',
    'modal-bg': 'rgba(15, 23, 42, 0.7)',
    'modal-shadow': '0 30px 80px rgba(0, 0, 0, 0.55)',
    'modal-backdrop': 'rgba(4, 6, 26, 0.7)',
    'sidebar-bg': 'rgba(255,255,255,0.06)',
    'sidebar-border': 'rgba(255,255,255,0.16)',
    'topbar-bg': 'rgba(255,255,255,0.08)',
    'topbar-border': 'rgba(255,255,255,0.16)',
    'grid-line': 'rgba(226, 232, 240, 0.1)',
    'button-bg': 'rgba(255,255,255,0.08)',
    'button-hover': 'rgba(255,255,255,0.15)',
    'button-active': 'rgba(56, 189, 248, 0.25)',
    'button-text': '#e2e8f0',
    'radius-sm': '10px',
    'radius-md': '14px',
    'radius-lg': '20px',
    'shadow-xs': '0 2px 8px rgba(15, 23, 42, 0.15)',
    'shadow-sm': '0 6px 18px rgba(15, 23, 42, 0.18)',
    'shadow-md': '0 12px 30px rgba(0, 0, 0, 0.28)',
    'shadow-lg': '0 24px 60px rgba(0, 0, 0, 0.35)',
    blur: '16px',
    'background-gradient':
      'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.12), transparent 35%), radial-gradient(circle at 80% 0%, rgba(56, 189, 248, 0.25), transparent 25%), linear-gradient(135deg, #0f172a 0%, #111827 50%, #0b1021 100%)',
  };
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  Object.entries(theme).forEach(([key, value]) => {
    if (key !== 'name' && key !== 'description') {
      const cssVar = `--${key}`;
      root.style.setProperty(cssVar, value);
    }
  });

  if (theme['background-gradient']) {
    root.style.setProperty('--bg-gradient', theme['background-gradient']);
  } else {
    root.style.removeProperty('--bg-gradient');
  }

  if (theme.blur) {
    root.style.setProperty('--blur', theme.blur);
  } else {
    root.style.setProperty('--blur', 'none');
  }

  root.setAttribute('data-theme', theme.name.toLowerCase().replace(/\s+/g, '-'));
}

export function getThemeCSSVariables(theme: Theme): string {
  let css = ':root {\n';
  Object.entries(theme).forEach(([key, value]) => {
    if (key !== 'name' && key !== 'description') {
      const cssVar = `--${key.replace(/_/g, '-')}`;
      css += `  ${cssVar}: ${value};\n`;
    }
  });
  css += '}\n';
  return css;
}
