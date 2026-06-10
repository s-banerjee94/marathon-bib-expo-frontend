/**
 * Named chart/legend palette helpers shared by the dashboards (billing overview,
 * org dashboard, …). Every colour comes straight from PrimeNG's predefined
 * primitive tokens (`--p-{name}-{shade}`, e.g. `--p-blue-500`) — no hard-coded
 * hex, so charts and swatches re-colour with the active theme. Charts paint to
 * <canvas> and need a concrete resolved value, while DOM swatches/icon chips
 * bind a live `var(--p-…)` reference.
 *
 * `name` is any PrimeNG primitive colour key: blue, green, teal, red, orange,
 * amber, yellow, violet, indigo, purple, cyan, sky, pink, rose, slate, …
 */

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Concrete colour for a canvas chart — the resolved PrimeNG primitive token. */
export function paletteResolve(name: string): string {
  return cssVar(`--p-${name}-500`);
}

/** Live `var(--p-…)` ref for DOM swatches/icons (re-colours with the theme). */
export function paletteRef(name: string): string {
  return `var(--p-${name}-500)`;
}

/** Soft tinted background for an icon chip — a translucent mix of the token. */
export function paletteTint(name: string, percent = 14): string {
  return `color-mix(in srgb, var(--p-${name}-500) ${percent}%, transparent)`;
}

/** Translucent fill for a canvas area, derived from an already-resolved colour. */
export function paletteAlpha(color: string, a: number): string {
  const hex = color.startsWith('#') ? color : '';
  if (hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;
}
