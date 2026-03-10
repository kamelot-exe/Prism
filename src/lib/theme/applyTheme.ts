import type { TokenMap } from './defaultTokens';

export function applyTheme(tokens: TokenMap): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
