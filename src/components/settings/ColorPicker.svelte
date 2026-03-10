<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  export let value = '#7ce7ff';
  export let swatches: string[] = ['#7ce7ff', '#ffcc00', '#ff8c68', '#a4f37c', '#9b8cfc', '#ff5f6d'];

  const dispatch = createEventDispatcher<{ change: string }>();

  let hue = 200;
  let saturation = 80;
  let lightness = 60;
  let r = 0;
  let g = 0;
  let b = 0;
  let wheelEl: HTMLButtonElement;

  onMount(() => syncFromHex(value));

  $: syncFromHex(value);
  $: ({ r, g, b } = hexToRgb(value));

  function syncFromHex(hex: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const { h, s, l } = hexToHsl(hex);
    hue = h;
    saturation = s;
    lightness = l;
  }

  function emit() {
    dispatch('change', value);
  }

  function hexToRgb(hex: string) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  function rgbToHex(r: number, g: number, b: number) {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const h = x.toString(16);
          return h.length === 1 ? '0' + h : h;
        })
        .join('')
    );
  }

  function hexToHsl(H: string) {
    const r = parseInt(H.substring(1, 3), 16) / 255;
    const g = parseInt(H.substring(3, 5), 16) / 255;
    const b = parseInt(H.substring(5, 7), 16) / 255;
    const cMin = Math.min(r, g, b);
    const cMax = Math.max(r, g, b);
    const delta = cMax - cMin;
    let h = 0;
    let s = 0;
    let l = (cMax + cMin) / 2;
    if (delta !== 0) {
      if (cMax === r) h = ((g - b) / delta) % 6;
      else if (cMax === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
      s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    }
    s = +(s * 100).toFixed(0);
    l = +(l * 100).toFixed(0);
    return { h, s, l };
  }

  function hslToHex(h: number, s: number, l: number) {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(255 * color);
    };
    return rgbToHex(f(0), f(8), f(4));
  }

  function handleWheelClick(event: MouseEvent) {
    if (!wheelEl) return;
    const rect = wheelEl.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const angle = Math.atan2(y, x);
    const deg = (angle * 180) / Math.PI;
    hue = Math.round((deg + 360) % 360);

    const dist = Math.min(Math.sqrt(x * x + y * y) / (rect.width / 2), 1);
    saturation = Math.round(dist * 100);
    value = hslToHex(hue, saturation, lightness);
    emit();
  }

  function handleWheelKey() {
    if (!wheelEl) return;
    const rect = wheelEl.getBoundingClientRect();
    const synthetic = new MouseEvent('click', {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    handleWheelClick(synthetic);
  }

  function handleLightnessChange(event: Event) {
    lightness = Number((event.target as HTMLInputElement).value);
    value = hslToHex(hue, saturation, lightness);
    emit();
  }

  function handleRgbChange(channel: 'r' | 'g' | 'b', event: Event) {
    const val = Math.min(255, Math.max(0, Number((event.target as HTMLInputElement).value)));
    const next = { r, g, b, [channel]: val } as { r: number; g: number; b: number };
    value = rgbToHex(next.r, next.g, next.b);
    emit();
  }

  function handleHexInput(event: Event) {
    const next = (event.target as HTMLInputElement).value;
    if (/^#[0-9A-Fa-f]{6}$/.test(next)) {
      value = next;
      syncFromHex(next);
      emit();
    }
  }

  function applySwatch(color: string) {
    value = color;
    syncFromHex(color);
    emit();
  }
</script>

<div class="picker">
  <div class="left">
    <button
      type="button"
      class="wheel"
      bind:this={wheelEl}
      on:click={handleWheelClick}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleWheelKey(); } }}
      aria-label="Color wheel"
    >
      <div class="wheel-overlay"></div>
      <div class="indicator" style={`transform: translate(-50%, -50%) rotate(${hue}deg) translate(${saturation / 2}%);`}></div>
    </button>
  </div>

  <div class="right">
    <div class="swatches">
      {#each swatches as swatch}
        <button
          class:active={swatch.toLowerCase() === value.toLowerCase()}
          style={`--swatch:${swatch}`}
          on:click={() => applySwatch(swatch)}
          aria-label={`Apply color ${swatch}`}
        ></button>
      {/each}
    </div>

    <div class="group">
      <label>
        <span>Lightness</span>
        <input type="range" min="0" max="100" bind:value={lightness} on:input={handleLightnessChange} />
      </label>
    </div>

    <div class="group rgb">
      <label><span>R</span><input type="number" min="0" max="255" value={r} on:input={(e) => handleRgbChange('r', e)} /></label>
      <label><span>G</span><input type="number" min="0" max="255" value={g} on:input={(e) => handleRgbChange('g', e)} /></label>
      <label><span>B</span><input type="number" min="0" max="255" value={b} on:input={(e) => handleRgbChange('b', e)} /></label>
    </div>

    <div class="group">
      <label>
        <span>HEX</span>
        <input type="text" maxlength="7" value={value} on:input={handleHexInput} />
      </label>
    </div>
  </div>
</div>

<style>
  .picker { display: grid; grid-template-columns: 200px 1fr; gap: 12px; }
  .left { display: grid; place-items: center; }
  .wheel {
    position: relative;
    width: 180px;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: conic-gradient(
      hsl(0, 100%, 50%),
      hsl(60, 100%, 50%),
      hsl(120, 100%, 50%),
      hsl(180, 100%, 50%),
      hsl(240, 100%, 50%),
      hsl(300, 100%, 50%),
      hsl(360, 100%, 50%)
    );
    cursor: crosshair;
    overflow: hidden;
  }
  .wheel-overlay {
    position: absolute;
    inset: 16%;
    border-radius: 50%;
    box-shadow: inset 0 0 0 60px rgba(0,0,0,0.35);
  }
  .indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--surface-1);
    border: 2px solid var(--border);
    box-shadow: var(--shadow-xs);
    pointer-events: none;
  }
  .right { display: grid; gap: 10px; }
  .group { display: grid; gap: 6px; }
  label { display: grid; gap: 0.2rem; color: var(--text-secondary); }
  input[type="range"] { width: 100%; accent-color: var(--accent, #7ce7ff); }
  input[type="number"], input[type="text"] {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-1);
    color: var(--text);
  }
  .rgb { grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .swatches { display: grid; grid-template-columns: repeat(auto-fit, minmax(32px, 1fr)); gap: 8px; }
  .swatches button {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    border: 2px solid transparent;
    cursor: pointer;
    background: var(--swatch);
  }
  .swatches button.active {
    border-color: var(--accent, #7ce7ff);
    box-shadow: var(--shadow-xs);
  }
</style>
