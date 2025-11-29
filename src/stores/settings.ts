import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { ThemeName } from '../lib/theme';

export interface Settings {
  theme: ThemeName;
  firstDayOfWeek: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  userCategoryColors?: Record<string, string>;
}

const defaultSettings: Settings = {
  theme: 'glassmorphism',
  firstDayOfWeek: 'monday',
  timeFormat: '24h',
  userCategoryColors: {},
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(defaultSettings);

  const loadSettings = async () => {
    try {
      const settings = await invoke<Settings>('get_settings').catch(() => defaultSettings);
      set(settings || defaultSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      set(defaultSettings);
    }
  };

  const saveSettings = async (newSettings: Partial<Settings>) => {
    try {
      update((current) => {
        const updated = { ...current, ...newSettings };
        invoke('save_settings', { settings: updated }).catch((error) => {
          console.error('Failed to persist settings:', error);
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const setTheme = async (theme: ThemeName) => {
    await saveSettings({ theme });
    await applyTheme(theme);
  };

  const applyTheme = async (theme: ThemeName) => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    let themeToApply: ThemeName = theme;

    try {
      const { loadTheme, applyTheme: applyThemeStyles } = await import('../lib/theme');
      const themeData = await loadTheme(themeToApply);
      applyThemeStyles(themeData);
      root.setAttribute('data-theme', themeToApply);
    } catch (error) {
      console.error('Failed to load theme:', error);
      root.setAttribute('data-theme', themeToApply);
    }
  };

  if (typeof document !== 'undefined') {
    loadSettings().then(() => {
      subscribe((settings) => {
        applyTheme(settings.theme);
      });
    });
  }

  const getCategoryColor = (categoryId: number, defaultColor: string): string => {
    const settings = get(settingsStore);
    return settings.userCategoryColors?.[categoryId.toString()] || defaultColor;
  };

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
