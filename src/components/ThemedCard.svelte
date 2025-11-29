<script lang="ts">
  import type { Theme } from '../lib/theme';

  export let theme: Theme;
  export let elevation: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let padding: 'sm' | 'md' | 'lg' = 'md';
  export let variant: 'default' | 'glass' = 'default';

  $: shadow = theme[`shadow-${elevation}` as keyof Theme] as string;
  $: borderRadius = theme['border-radius-md'] as string;
  $: bgColor = variant === 'glass' && theme['bg-card'] ? theme['bg-card'] : theme['bg-primary'];
  $: paddingValue = padding === 'sm' ? '0.75rem' : padding === 'lg' ? '2rem' : '1.5rem';
  $: backdropBlur = variant === 'glass' ? theme['backdrop-blur'] : 'none';
</script>

<div
  class="themed-card"
  class:glass={variant === 'glass'}
  style:background={bgColor}
  style:border-color={theme['border-color']}
  style:border-radius={borderRadius}
  style:box-shadow={shadow}
  style:backdrop-filter={backdropBlur}
  style:-webkit-backdrop-filter={backdropBlur}
  style:padding={paddingValue}
>
  <slot />
</div>

<style>
  .themed-card {
    border: 1px solid;
    transition: all var(--animation-duration, 0.3s) var(--animation-easing, ease);
  }

  .themed-card.glass {
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
</style>

