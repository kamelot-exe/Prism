<script lang="ts">
  export let value: string = '#3b82f6';
  export let label: string = 'Color';
  export let showLabel = true;

  let isOpen = false;
  let hue = 0;
  let saturation = 100;
  let lightness = 50;
  let alpha = 1;

  // Predefined color palette
  const presetColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#ef4444',
    '#000000', '#ffffff', '#6b7280', '#9ca3af', '#d1d5db'
  ];

  $: if (value) {
    updateFromHex(value);
  }

  function updateFromHex(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    lightness = (max + min) / 2;

    if (delta === 0) {
      hue = 0;
      saturation = 0;
    } else {
      saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

      if (max === r) {
        hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        hue = ((b - r) / delta + 2) / 6;
      } else {
        hue = ((r - g) / delta + 4) / 6;
      }
    }

    hue = Math.round(hue * 360);
    saturation = Math.round(saturation * 100);
    lightness = Math.round(lightness * 100);
  }

  function updateFromHSL() {
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h < 1/6) {
      r = c; g = x; b = 0;
    } else if (h < 2/6) {
      r = x; g = c; b = 0;
    } else if (h < 3/6) {
      r = 0; g = c; b = x;
    } else if (h < 4/6) {
      r = 0; g = x; b = c;
    } else if (h < 5/6) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    value = `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
    dispatch('change', { detail: value });
  }

  function selectPresetColor(color: string) {
    value = color;
    updateFromHex(color);
    dispatch('change', { detail: value });
  }

  function handleHueChange(event: Event) {
    const target = event.target as HTMLInputElement;
    hue = parseInt(target.value);
    updateFromHSL();
  }

  function handleSaturationChange(event: Event) {
    const target = event.target as HTMLInputElement;
    saturation = parseInt(target.value);
    updateFromHSL();
  }

  function handleLightnessChange(event: Event) {
    const target = event.target as HTMLInputElement;
    lightness = parseInt(target.value);
    updateFromHSL();
  }

  function handleHexInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const hex = target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      value = hex;
      updateFromHex(hex);
      dispatch('change', { detail: value });
    }
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ change: string }>();

  $: currentColor = value;
  $: hslColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
</script>

<div class="color-picker">
  {#if showLabel}
    <label class="color-picker-label">{label}</label>
  {/if}

  <div class="color-picker-container">
    <button
      class="color-preview"
      style:background={value}
      on:click={() => isOpen = !isOpen}
      type="button"
    >
      <span class="color-value">{value}</span>
    </button>

    {#if isOpen}
      <div class="color-picker-popup">
        <div class="color-picker-section">
          <h4>Preset Colors</h4>
          <div class="preset-colors">
            {#each presetColors as color}
              <button
                class="preset-color"
                class:active={color === value}
                style:background={color}
                on:click={() => selectPresetColor(color)}
                type="button"
                title={color}
              ></button>
            {/each}
          </div>
        </div>

        <div class="color-picker-section">
          <h4>Custom Color</h4>
          
          <div class="color-display" style:background={hslColor}></div>

          <div class="slider-group">
            <label>
              <span>Hue</span>
              <input
                type="range"
                min="0"
                max="360"
                value={hue}
                on:input={handleHueChange}
                class="slider hue-slider"
              />
            </label>

            <label>
              <span>Saturation</span>
              <input
                type="range"
                min="0"
                max="100"
                value={saturation}
                on:input={handleSaturationChange}
                class="slider saturation-slider"
              />
            </label>

            <label>
              <span>Lightness</span>
              <input
                type="range"
                min="0"
                max="100"
                value={lightness}
                on:input={handleLightnessChange}
                class="slider lightness-slider"
              />
            </label>
          </div>

          <div class="hex-input-group">
            <label>
              <span>Hex</span>
              <input
                type="text"
                value={value}
                on:input={handleHexInput}
                class="hex-input"
                placeholder="#000000"
                maxlength="7"
              />
            </label>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .color-picker {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .color-picker-label {
    font-size: 0.875rem;
    font-weight: var(--font-weight-medium, 500);
    color: var(--text-primary);
  }

  .color-picker-container {
    position: relative;
  }

  .color-preview {
    width: 100%;
    min-height: 40px;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-md, 0.5rem);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    transition: all 0.2s;
  }

  .color-preview:hover {
    border-color: var(--accent-color);
    transform: scale(1.02);
  }

  .color-value {
    color: white;
    font-weight: var(--font-weight-semibold, 600);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    font-size: 0.875rem;
  }

  .color-picker-popup {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg, 0.75rem);
    padding: 1.5rem;
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    max-width: 400px;
  }

  .color-picker-section {
    margin-bottom: 1.5rem;
  }

  .color-picker-section:last-child {
    margin-bottom: 0;
  }

  .color-picker-section h4 {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
  }

  .preset-colors {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 0.5rem;
  }

  .preset-color {
    aspect-ratio: 1;
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-sm, 0.375rem);
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
  }

  .preset-color:hover {
    transform: scale(1.1);
    border-color: var(--accent-color);
  }

  .preset-color.active {
    border-color: var(--accent-color);
    border-width: 3px;
    box-shadow: 0 0 0 2px var(--bg-primary);
  }

  .color-display {
    width: 100%;
    height: 80px;
    border-radius: var(--border-radius-md, 0.5rem);
    border: 1px solid var(--border-color);
    margin-bottom: 1rem;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .slider-group label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .slider-group span {
    min-width: 80px;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--bg-secondary);
    outline: none;
    -webkit-appearance: none;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
    border: 2px solid var(--bg-primary);
  }

  .slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent-color);
    cursor: pointer;
    border: 2px solid var(--bg-primary);
  }

  .hue-slider {
    background: linear-gradient(to right,
      #ff0000, #ff7f00, #ffff00, #7fff00,
      #00ff00, #00ff7f, #00ffff, #007fff,
      #0000ff, #7f00ff, #ff00ff, #ff007f, #ff0000
    );
  }

  .hex-input-group {
    margin-top: 1rem;
  }

  .hex-input-group label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .hex-input-group span {
    min-width: 80px;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .hex-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm, 0.375rem);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: monospace;
    font-size: 0.875rem;
  }

  .hex-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }
</style>

