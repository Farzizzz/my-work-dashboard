// Author: Farz Owasil (my-work-dashboard)
// theme.mjs - turns a preset / brand colours into full light + dark token sets, enforces WCAG
// contrast (auto-adjusting colours that fail and reporting what changed), and emits the CSS + logo.
// Usage as a CLI:  node theme.mjs <answers.json>   → prints the contrast report + tokens

export const PRESETS = {
  slate:    { label: 'Slate (indigo on charcoal)', primary: '#4f46e5', accent1: '#0284c7', accent2: '#db2777', accent3: '#059669', head1: '#1e293b', head2: '#0f172a' },
  ocean:    { label: 'Ocean (blues and teals)',    primary: '#0369a1', accent1: '#0891b2', accent2: '#4f46e5', accent3: '#0d9488', head1: '#0c4a6e', head2: '#082f49' },
  forest:   { label: 'Forest (greens, warm gold)', primary: '#15803d', accent1: '#b45309', accent2: '#0f766e', accent3: '#4d7c0f', head1: '#14532d', head2: '#052e16' },
  sunset:   { label: 'Sunset (orange, pink, plum)', primary: '#c2410c', accent1: '#db2777', accent2: '#7c3aed', accent3: '#b45309', head1: '#7c2d12', head2: '#431407' },
  berry:    { label: 'Berry (purple, magenta)',    primary: '#7e22ce', accent1: '#c026d3', accent2: '#e11d48', accent3: '#4338ca', head1: '#3b0764', head2: '#1e0336' },
  mono:     { label: 'Mono (greyscale)',           primary: '#374151', accent1: '#4b5563', accent2: '#111827', accent3: '#6b7280', head1: '#1f2937', head2: '#111827' },
  contrast: { label: 'High contrast',              primary: '#1d4ed8', accent1: '#9a3412', accent2: '#6b21a8', accent3: '#065f46', head1: '#000000', head2: '#111111' }
};

const LIGHT = { page: '#f3f4f7', surface: '#ffffff', surface2: '#f6f7fa', line: '#e3e6ec', ink: '#1c2030', muted: '#525b6b', faint: '#666f7e', good: '#15803d', warn: '#b45309', bad: '#b91c1c' };
const DARK  = { page: '#0b0d12', surface: '#151821', surface2: '#1b1f2a', line: '#2b3140', ink: '#e8eaf0', muted: '#aab2c0', faint: '#949cab', good: '#4ade80', warn: '#fbbf24', bad: '#f87171' };

// ---------- colour maths ----------
export function hexToRgb(h) {
  let s = String(h).trim().replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) throw new Error('Not a hex colour: ' + h);
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}
const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const lum = hex => { const c = hexToRgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const setL = (hex, l) => { const [h, s] = rgbToHsl(hexToRgb(hex)); return toHex(hslToRgb([h, s, l])); };
const shiftH = (hex, deg) => { const [h, s, l] = rgbToHsl(hexToRgb(hex)); return toHex(hslToRgb([h + deg, s, l])); };
export const mix = (a, b, t) => { const x = hexToRgb(a), y = hexToRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

/** Move fg's lightness away from bg until contrast ≥ min. Returns the (possibly unchanged) colour. */
function ensure(fg, bg, min) {
  if (contrast(fg, bg) >= min) return fg;
  const darker = lum(bg) > .5;
  let [, , l] = rgbToHsl(hexToRgb(fg));
  for (let i = 0; i < 100; i++) {
    l = darker ? Math.max(0, l - .01) : Math.min(1, l + .01);
    const c = setL(fg, l);
    if (contrast(c, bg) >= min) return c;
  }
  return darker ? '#000000' : '#ffffff';
}
const bestOn = (bg, light = '#ffffff', dark = '#0b0d12') => contrast(light, bg) >= contrast(dark, bg) ? light : dark;

// ---------- palette ----------
/** answers.theme → { light, dark, report[] }. theme = { preset?, colors?{primary,accent1..3,head1,head2,+neutrals}, mode } */
export function buildTheme(theme = {}) {
  const base = Object.assign({}, PRESETS[theme.preset] || (theme.colors && theme.colors.primary ? {} : PRESETS.slate), theme.colors || {});
  if (!base.primary) base.primary = PRESETS.slate.primary;
  base.accent1 = base.accent1 || shiftH(base.primary, 40);
  base.accent2 = base.accent2 || shiftH(base.primary, -50);
  base.accent3 = base.accent3 || shiftH(base.primary, 150);
  base.head1 = base.head1 || setL(base.primary, .22);
  base.head2 = base.head2 || setL(base.head1, Math.max(.06, rgbToHsl(hexToRgb(base.head1))[2] - .1));
  const report = [];
  const fix = (mode, name, fg, bg, min) => {
    const out = ensure(fg, bg, min);
    if (out.toLowerCase() !== fg.toLowerCase()) report.push(`${mode}: ${name} ${fg} → ${out} (needed ${min}:1 on ${bg}, had ${contrast(fg, bg).toFixed(2)}:1)`);
    return out;
  };
  const make = (mode, N) => {
    const n = Object.assign({}, N);
    ['page', 'surface', 'surface2', 'line', 'ink', 'muted', 'faint', 'good', 'warn', 'bad'].forEach(k => { const v = theme.colors && theme.colors[mode + '_' + k]; if (v) n[k] = v; });
    const t = Object.assign({}, n);
    t.ink = fix(mode, 'text', n.ink, n.surface, 7);
    t.muted = fix(mode, 'secondary text', n.muted, n.surface, 4.5);
    t.faint = fix(mode, 'hint text', n.faint, n.surface, 4.5);
    t.primary = fix(mode, 'primary', base.primary, n.surface, 3);         // big numbers, bars, active tab underline
    t['primary-ink'] = fix(mode, 'primary text', base.primary, n.surface, 4.5); // links, keys, small coloured text
    ['accent1', 'accent2', 'accent3'].forEach(k => { t[k] = fix(mode, k, base[k], n.surface, 3); });
    ['good', 'warn', 'bad'].forEach(k => { t[k] = fix(mode, k, n[k], n.surface, 3); });
    t['on-primary'] = bestOn(t.primary);
    if (contrast(t['on-primary'], t.primary) < 4.5) report.push(`${mode}: button text on primary is ${contrast(t['on-primary'], t.primary).toFixed(2)}:1 (below 4.5) - consider a darker/lighter primary`);
    t.head1 = base.head1; t.head2 = base.head2;
    t['on-head'] = bestOn(mix(base.head1, base.head2, .5));
    const onHeadMin = Math.min(contrast(t['on-head'], base.head1), contrast(t['on-head'], base.head2));
    if (onHeadMin < 4.5) report.push(`${mode}: header text contrast only ${onHeadMin.toFixed(2)}:1 - use a darker or lighter header colour`);
    const sub = mix(t['on-head'], base.head1, .3);
    const worst = contrast(sub, base.head1) < contrast(sub, base.head2) ? base.head1 : base.head2;
    t['on-head-muted'] = ensure(sub, worst, 4.5);
    return t;
  };
  return { base, light: make('light', LIGHT), dark: make('dark', DARK), report };
}

export function themeCss(built, mode = 'auto') {
  const vars = t => Object.keys(t).map(k => `--${k}:${t[k]};`).join('');
  if (mode === 'light') return `:root{${vars(built.light)}color-scheme:light}`;
  if (mode === 'dark') return `:root{${vars(built.dark)}color-scheme:dark}`;
  return `:root{${vars(built.light)}color-scheme:light}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(built.dark)}color-scheme:dark}}` +
    `:root[data-theme="dark"]{${vars(built.dark)}color-scheme:dark}:root[data-theme="light"]{${vars(built.light)}color-scheme:light}`;
}

// ---------- logo ----------
const escAttr = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function monogram(text, built) {
  const initials = String(text || 'Me').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  const fill = built.base.primary, ink = bestOn(fill);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="56" height="56" role="img" aria-label="${escAttr(initials)}"><rect width="64" height="64" rx="16" fill="${fill}"/><text x="32" y="41" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="${initials.length > 2 ? 20 : 26}" font-weight="700" fill="${ink}">${escAttr(initials)}</text></svg>`;
}
/** logo = { type: 'monogram'|'url'|'svg'|'none', value, boxed? } → { html, boxed } */
export function logoHtml(logo, built, ownerName) {
  const l = logo || { type: 'monogram' };
  if (l.type === 'none') return { html: '', boxed: false };
  if (l.type === 'url') {
    if (!/^https:\/\//i.test(l.value || '')) throw new Error('Logo URL must start with https://');
    return { html: `<img src="${escAttr(l.value)}" alt="logo">`, boxed: l.boxed !== false };
  }
  if (l.type === 'svg') {
    const svg = String(l.value || '');
    if (!/^\s*<svg[\s>]/i.test(svg)) throw new Error('Pasted logo must be an <svg>…</svg>');
    const clean = svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/javascript:/gi, '');
    return { html: clean, boxed: l.boxed !== false };
  }
  return { html: monogram(l.value || ownerName, built), boxed: false };
}

// ---------- CLI ----------
if (process.argv[1] && (await import('node:url')).fileURLToPath(import.meta.url) === (await import('node:path')).resolve(process.argv[1])) {
  const fs = await import('node:fs');
  const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const t = buildTheme(a.theme || {});
  console.log(t.report.length ? 'Adjusted for readability:\n  ' + t.report.join('\n  ') : 'All colours pass WCAG AA as given.');
  console.log(JSON.stringify({ light: t.light, dark: t.dark }, null, 2));
}
