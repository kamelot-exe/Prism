export interface Theme {
  name: string;
  description?: string;
  'bg-primary': string;
  'bg-secondary': string;
  'bg-hover': string;
  'bg-card'?: string;
  'text-primary': string;
  'text-secondary': string;
  'text-muted'?: string;
  'border-color': string;
  'accent-color': string;
  'accent-hover': string;
  'accent-light'?: string;
  'success-color': string;
  'error-color': string;
  'warning-color': string;
  'border-radius-sm': string;
  'border-radius-md': string;
  'border-radius-lg': string;
  'border-radius-xl': string;
  'shadow-sm': string;
  'shadow-md': string;
  'shadow-lg': string;
  'shadow-xl': string;
  'backdrop-blur'?: string;
  'font-family': string;
  'font-weight-normal': string;
  'font-weight-medium': string;
  'font-weight-semibold': string;
  'font-weight-bold': string;
  'animation-duration': string;
  'animation-easing': string;
  'background-gradient'?: string;
}

export type ThemeName = 'light' | 'dark' | 'glassmorphism' | 'avant-garde' | 'brutalism' | 'aurora-vibe';

export async function loadTheme(themeName: ThemeName): Promise<Theme> {
  try {
    // Handle theme name mapping for file names
    const themeFileName = themeName === 'avant-garde' ? 'avant-garde' : themeName;
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
      // Return a minimal default theme
      return {
        name: 'Light',
        'bg-primary': '#ffffff',
        'bg-secondary': '#f9fafb',
        'bg-hover': '#f3f4f6',
        'text-primary': '#111827',
        'text-secondary': '#6b7280',
        'border-color': '#e5e7eb',
        'accent-color': '#3b82f6',
        'accent-hover': '#2563eb',
        'success-color': '#10b981',
        'error-color': '#ef4444',
        'warning-color': '#f59e0b',
        'border-radius-sm': '0.375rem',
        'border-radius-md': '0.5rem',
        'border-radius-lg': '0.75rem',
        'border-radius-xl': '1rem',
        'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'shadow-md': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'shadow-xl': '0 20px 25px rgba(0, 0, 0, 0.15)',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
        'font-weight-normal': '400',
        'font-weight-medium': '500',
        'font-weight-semibold': '600',
        'font-weight-bold': '700',
        'animation-duration': '0.3s',
        'animation-easing': 'cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
  }
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Apply all theme properties as CSS variables
  Object.entries(theme).forEach(([key, value]) => {
    if (key !== 'name' && key !== 'description') {
      const cssVar = `--${key.replace(/-/g, '-')}`;
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
  if (theme['backdrop-blur']) {
    root.style.setProperty('--backdrop-blur', theme['backdrop-blur']);
  } else {
    root.style.removeProperty('--backdrop-blur');
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

