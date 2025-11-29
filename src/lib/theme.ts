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

export type ThemeName = 'light' | 'dark' | 'glassmorphism' | 'avant-garde' | 'brutalism' | 'yeezy-minimal';

export async function loadTheme(themeName: ThemeName): Promise<Theme> {
  try {
    // Handle theme name mapping for file names
    let themeFileName = themeName;
    if (themeName === 'avant-garde') {
      themeFileName = 'avant-garde';
    } else if (themeName === 'yeezy-minimal') {
      themeFileName = 'yeezy-minimal';
    }
    
    const response = await fetch(`/themes/${themeFileName}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load theme: ${themeName}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading theme ${themeName}:`, error);
    // Fallback to light theme
    try {
      const fallback = await fetch('/themes/light.json');
      return await fallback.json();
    } catch (fallbackError) {
      console.error('Failed to load fallback theme:', fallbackError);
      // Return a minimal default theme with new token system
      return getDefaultTheme();
    }
  }
}

function getDefaultTheme(): Theme {
  return {
    name: 'Light',
    bg: '#ffffff',
    'bg-secondary': '#f9fafb',
    'bg-hover': '#f3f4f6',
    text: '#111827',
    'text-secondary': '#6b7280',
    'text-muted': '#9ca3af',
    accent: '#3b82f6',
    'accent-secondary': '#2563eb',
    'accent-light': 'rgba(59, 130, 246, 0.1)',
    border: '#e5e7eb',
    'border-light': 'rgba(229, 231, 235, 0.5)',
    'card-bg': '#ffffff',
    'card-border': '#e5e7eb',
    'card-shadow': '0 1px 3px rgba(0, 0, 0, 0.1)',
    'modal-bg': '#ffffff',
    'modal-shadow': '0 20px 25px rgba(0, 0, 0, 0.15)',
    'modal-backdrop': 'rgba(0, 0, 0, 0.5)',
    'sidebar-bg': '#ffffff',
    'sidebar-border': '#e5e7eb',
    'topbar-bg': '#ffffff',
    'topbar-border': '#e5e7eb',
    'grid-line': '#e5e7eb',
    'button-bg': '#f3f4f6',
    'button-hover': '#e5e7eb',
    'button-active': '#d1d5db',
    'button-text': '#111827',
    'radius-sm': '4px',
    'radius-md': '8px',
    'radius-lg': '16px',
    'shadow-xs': '0 1px 2px rgba(0, 0, 0, 0.05)',
    'shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
    'shadow-md': '0 4px 6px rgba(0, 0, 0, 0.1)',
    'shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
    blur: 'none',
  };
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Apply all theme properties as CSS variables
  Object.entries(theme).forEach(([key, value]) => {
    if (key !== 'name' && key !== 'description') {
      // Convert kebab-case to CSS variable format
      const cssVar = `--${key}`;
      root.style.setProperty(cssVar, value);
    }
  });
  
  // Set background gradient if available
  if (theme['background-gradient']) {
    root.style.setProperty('--bg-gradient', theme['background-gradient']);
  } else {
    root.style.removeProperty('--bg-gradient');
  }
  
  // Set backdrop blur if available
  if (theme.blur) {
    root.style.setProperty('--blur', theme.blur);
  } else {
    root.style.setProperty('--blur', 'none');
  }
  
  // Set data attribute for theme-specific styling
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

