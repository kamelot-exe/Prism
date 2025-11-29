import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export type ThemeName = 'light' | 'dark' | 'glassmorphism' | 'avant-garde' | 'brutalism' | 'yeezy-minimal' | 'auto';

export interface Settings {
  theme: ThemeName;
  firstDayOfWeek: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  userCategoryColors?: Record<string, string>;
}

const defaultSettings: Settings = {
  theme: 'light',
  firstDayOfWeek: 'monday',
  timeFormat: '24h',
  userCategoryColors: {},
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(defaultSettings);

  // Load settings from database on initialization
  const loadSettings = async () => {
    try {
      // TODO: Implement get_settings Tauri command
      // const settings = await invoke<Settings>('get_settings');
      // set(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use defaults if loading fails
      set(defaultSettings);
    }
  };

  // Save settings to database
  const saveSettings = async (newSettings: Partial<Settings>) => {
    try {
      update((current) => {
        const updated = { ...current, ...newSettings };
        // TODO: Implement save_settings Tauri command
        // invoke('save_settings', { settings: updated });
        return updated;
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Theme switcher
  const setTheme = async (theme: ThemeName) => {
    await saveSettings({ theme });
    await applyTheme(theme);
  };

  // Apply theme to document
  const applyTheme = async (theme: ThemeName) => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    let themeToApply: string;
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeToApply = prefersDark ? 'dark' : 'light';
    } else {
      themeToApply = theme;
    }

    // Load and apply theme
    try {
      const { loadTheme, applyTheme: applyThemeStyles } = await import('../lib/theme');
      const themeData = await loadTheme(themeToApply as any);
      applyThemeStyles(themeData);
    } catch (error) {
      console.error('Failed to load theme:', error);
      // Fallback to simple data attribute
      root.setAttribute('data-theme', themeToApply);
    }
  };

  // Initialize theme on store creation
  if (typeof document !== 'undefined') {
    loadSettings().then(() => {
      subscribe((settings) => {
        applyTheme(settings.theme);
      });
    });
  }

  // Get user color for category (override category color if set)
  const getCategoryColor = (categoryId: number, defaultColor: string): string => {
    const settings = get(settingsStore);
    return settings.userCategoryColors?.[categoryId.toString()] || defaultColor;
  };

  // Set user color for category
  const setCategoryColor = async (categoryId: number, color: string) => {
    update((current) => {
      const userCategoryColors = current.userCategoryColors || {};
      userCategoryColors[categoryId.toString()] = color;
      return { ...current, userCategoryColors };
    });
    await saveSettings({ userCategoryColors: get(settingsStore).userCategoryColors });
  };

  return {
    subscribe,
    set,
    update,
    loadSettings,
    saveSettings,
    setTheme,
    applyTheme,
    getCategoryColor,
    setCategoryColor,
  };
}

export const settingsStore = createSettingsStore();

