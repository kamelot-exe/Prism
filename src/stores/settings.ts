import { writable, get } from 'svelte/store';
import { applyTheme } from '../lib/theme/applyTheme';
import { defaultTokens, type TokenMap } from '../lib/theme/defaultTokens';
import { themeRegistry } from '../lib/theme/themeRegistry';
import { safeInvoke } from '../lib/safeInvoke';
import { toastStore } from './toastStore';
import { isTauriEnvironment } from '../lib/safeInvoke';
import type { Goal, WeeklyPlan } from '../lib/productivity/goals';

type ThemeName = string;

export interface ProductivitySettings {
  pomodoroFocus: number;
  pomodoroBreak: number;
  pomodoroAutoStart?: boolean;
  quickAddDuration: number;
  todoAutoRoll: boolean;
  workDayStart?: string;
  workDayEnd?: string;
  goals?: Goal[];
  weeklyPlan?: Record<string, WeeklyPlan>;
  weeklyCarry?: boolean;
}

export interface Settings {
  theme: ThemeName;
  currentTheme: ThemeName;
  firstDayOfWeek: 'monday' | 'sunday';
  timeFormat: '12h' | '24h';
  userCategoryColors?: Record<string, string>;
  productivity: ProductivitySettings;
}

const defaultSettings: Settings = {
  theme: 'base',
  currentTheme: 'base',
  firstDayOfWeek: 'monday',
  timeFormat: '24h',
  userCategoryColors: {},
  productivity: {
    pomodoroFocus: 25,
    pomodoroBreak: 5,
    pomodoroAutoStart: true,
    quickAddDuration: 60,
    todoAutoRoll: true,
    workDayStart: "09:00",
    workDayEnd: "18:00",
    goals: [],
    weeklyPlan: {},
    weeklyCarry: false,
  },
};

const resolveThemeTokens = (themeName: ThemeName): TokenMap => {
  const theme = themeRegistry.find((entry) => entry.name === themeName);
  return { ...defaultTokens, ...(theme?.tokens ?? {}) };
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(defaultSettings);
  let initialized = false;

  const loadSettings = async () => {
    try {
      const settings =
        (await safeInvoke<Settings>('settings_get').catch(() => defaultSettings)) || defaultSettings;
      const merged = {
        ...defaultSettings,
        ...(settings || {}),
        productivity: { ...defaultSettings.productivity, ...(settings?.productivity || {}) },
      };
      set(merged);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toastStore.showError('Could not load settings');
      set(defaultSettings);
    }
  };

  const saveSettings = async (newSettings: Partial<Settings> & { productivity?: Partial<ProductivitySettings> }) => {
    try {
      update((current) => {
        const updated: Settings = {
          ...current,
          ...newSettings,
          productivity: {
            ...current.productivity,
            ...(newSettings.productivity || {}),
          },
        };
        safeInvoke('settings_save', { settings: updated }).catch((error) => {
          console.error('Failed to persist settings:', error);
          toastStore.showError('Could not save settings');
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toastStore.showError('Could not save settings');
    }
  };

  const switchTheme = async (theme: ThemeName) => {
    applyTheme(resolveThemeTokens(theme));
  };

  const setTheme = async (theme: ThemeName) => {
    await switchTheme(theme);
    await saveSettings({ theme, currentTheme: theme });
  };

  const init = () => {
    if (initialized || typeof document === 'undefined') return;
    initialized = true;
    subscribe((settings) => {
      applyTheme(resolveThemeTokens(settings.theme));
    });
    if (isTauriEnvironment()) {
      loadSettings();
    } else {
      set(defaultSettings);
      applyTheme(resolveThemeTokens(defaultSettings.theme));
    }
  };

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
    applyTheme: switchTheme,
    getCategoryColor,
    setCategoryColor,
    init,
  };
}

export const settingsStore = createSettingsStore();
