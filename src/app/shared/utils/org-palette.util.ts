/**
 * Deterministic colour family for an organization, drawn from PrimeNG's primitive
 * palette (`--p-{hue}-{shade}`, injected by the active theme at runtime) with hex
 * fallbacks. Hashing the org id to a hue gives each org a stable, "random-looking"
 * colour that stays consistent between its avatar and its bill-card accent.
 */
export interface OrgHue {
  /** PrimeNG palette name, e.g. `blue` → `--p-blue-500`. */
  name: string;
  /** Hex fallbacks by shade, used until the theme's CSS variable resolves. */
  fallback: Record<number, string>;
}

// PrimeNG's full set of vivid primitive palettes (grays excluded so accents stay visible).
const HUES: OrgHue[] = [
  { name: 'red', fallback: { 100: '#fee2e2', 500: '#ef4444', 700: '#b91c1c' } },
  { name: 'orange', fallback: { 100: '#ffedd5', 500: '#f97316', 700: '#c2410c' } },
  { name: 'amber', fallback: { 100: '#fef3c7', 500: '#f59e0b', 700: '#b45309' } },
  { name: 'yellow', fallback: { 100: '#fef9c3', 500: '#eab308', 700: '#a16207' } },
  { name: 'lime', fallback: { 100: '#ecfccb', 500: '#84cc16', 700: '#4d7c0f' } },
  { name: 'green', fallback: { 100: '#dcfce7', 500: '#22c55e', 700: '#15803d' } },
  { name: 'emerald', fallback: { 100: '#d1fae5', 500: '#10b981', 700: '#047857' } },
  { name: 'teal', fallback: { 100: '#ccfbf1', 500: '#14b8a6', 700: '#0f766e' } },
  { name: 'cyan', fallback: { 100: '#cffafe', 500: '#06b6d4', 700: '#0e7490' } },
  { name: 'sky', fallback: { 100: '#e0f2fe', 500: '#0ea5e9', 700: '#0369a1' } },
  { name: 'blue', fallback: { 100: '#dbeafe', 500: '#3b82f6', 700: '#1d4ed8' } },
  { name: 'indigo', fallback: { 100: '#e0e7ff', 500: '#6366f1', 700: '#4338ca' } },
  { name: 'violet', fallback: { 100: '#ede9fe', 500: '#8b5cf6', 700: '#6d28d9' } },
  { name: 'purple', fallback: { 100: '#f3e8ff', 500: '#a855f7', 700: '#7e22ce' } },
  { name: 'fuchsia', fallback: { 100: '#fae8ff', 500: '#d946ef', 700: '#a21caf' } },
  { name: 'pink', fallback: { 100: '#fce7f3', 500: '#ec4899', 700: '#be185d' } },
  { name: 'rose', fallback: { 100: '#ffe4e6', 500: '#f43f5e', 700: '#be123c' } },
];

/** Pick a random hue from the palette. Cache the result per item so it doesn't change between renders. */
export function randomHue(): OrgHue {
  return HUES[Math.floor(Math.random() * HUES.length)];
}

/** `var(--p-{hue}-{shade}, {hexFallback})` — theme palette first, hex if unresolved. */
export function hueVar(hue: OrgHue, shade: number): string {
  return `var(--p-${hue.name}-${shade}, ${hue.fallback[shade]})`;
}
