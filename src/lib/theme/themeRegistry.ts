import type { TokenMap } from './defaultTokens';
import auroraNeon from './themes/aurora_neon';
import blueprintTechnical from './themes/blueprint';
import claymorphismSoft from './themes/claymorphism';
import cyberMinimalGrid from './themes/cyber_minimal';
import glassmorphism from './themes/glass';
import sunsetFade from './themes/sunset_fade';

export interface ThemeDefinition {
  name: string;
  tokens: TokenMap;
}

export const themeRegistry: ThemeDefinition[] = [
  glassmorphism,
  auroraNeon,
  claymorphismSoft,
  cyberMinimalGrid,
  sunsetFade,
  blueprintTechnical,
];
