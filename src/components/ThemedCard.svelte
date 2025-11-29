<script lang="ts">
  import type { Theme } from '../lib/theme';

  export let theme: Theme;
  export let elevation: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  export let padding: 'sm' | 'md' | 'lg' = 'md';
  export let variant: 'default' | 'glass' = 'default';

  $: shadow = theme[`shadow-${elevation}` as keyof Theme] as string || theme['shadow-md'];
  $: borderRadius = theme['radius-md'];
  $: bgColor = variant === 'glass' ? theme['card-bg'] : theme['card-bg'];
  $: paddingValue = padding === 'sm' ? 'var(--spacing-md)' : padding === 'lg' ? 'var(--spacing-2xl)' : 'var(--spacing-xl)';
  $: backdropBlur = variant === 'glass' && theme.blur ? theme.blur : 'none';
</script>

<div
  class="themed-card"
  class:glass={variant === 'glass'}
  style:background={bgColor}
  style:border-color={theme['card-border']}
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
    transition: all var(--animation-duration) var(--animation-easing);
  }

  .themed-card.glass {
    border: 1px solid var(--border-light, rgba(255, 255, 255, 0.2));
  }
</style>

