/**
 * Personal look for the curriculum map: background, texture, card style, colors and type.
 * Stored apart from the academic state (it is presentation only) and applied as one
 * generated stylesheet, so it survives every rerender of the app.
 */
export type BackgroundType = 'none' | 'solid' | 'elliptic' | 'linear' | 'mesh'
export type TextureType = 'none' | 'dots' | 'grid' | 'grain'
export type CardStyle = 'solid' | 'glass' | 'outline'
export type Density = 'compact' | 'normal' | 'comfy'
export type FontChoice = 'system' | 'display' | 'mono' | 'serif'

export type Look = {
  background: { type: BackgroundType; colors: string[]; angle: number }
  texture: { type: TextureType; amount: number }
  cards: { style: CardStyle; radius: number; shadow: number; density: Density }
  tracks: { foundation: string; discipline: string; choice: string; approved: string }
  font: FontChoice
}

export const LOOK_KEY = 'mallatronica-look-v1'

export const defaultLook: Look = {
  background: { type: 'none', colors: ['#f4efe6', '#e3573c', '#3b1b16', '#050506'], angle: 135 },
  texture: { type: 'none', amount: 40 },
  cards: { style: 'solid', radius: 9, shadow: 0, density: 'normal' },
  tracks: { foundation: '#a77c24', discipline: '#537181', choice: '#778775', approved: '#27805b' },
  font: 'system',
}

const look = (patch: { background?: Partial<Look['background']>; texture?: Partial<Look['texture']>; cards?: Partial<Look['cards']>; tracks?: Partial<Look['tracks']>; font?: FontChoice }): Look => ({
  background: { ...defaultLook.background, ...patch.background },
  texture: { ...defaultLook.texture, ...patch.texture },
  cards: { ...defaultLook.cards, ...patch.cards },
  tracks: { ...defaultLook.tracks, ...patch.tracks },
  font: patch.font ?? defaultLook.font,
})

export const presets: { id: string; name: string; look: Look }[] = [
  { id: 'original', name: 'Original', look: defaultLook },
  { id: 'papel', name: 'Papel', look: look({ background: { type: 'solid', colors: ['#f3ede2', '#e9e1d2', '#d8ccb6', '#b9a888'] }, texture: { type: 'grain', amount: 55 }, cards: { radius: 4 }, tracks: { foundation: '#9a6b1f', discipline: '#4d6470', choice: '#6f7d5c', approved: '#3f7a4a' }, font: 'serif' }) },
  { id: 'atardecer', name: 'Atardecer', look: look({ background: { type: 'elliptic', colors: ['#f6e9dc', '#e3573c', '#3b1b16', '#050506'] }, texture: { type: 'grain', amount: 35 }, cards: { style: 'glass', radius: 14, shadow: 2 }, tracks: { foundation: '#f0a35e', discipline: '#e3573c', choice: '#c9b8a6', approved: '#4fb37a' }, font: 'display' }) },
  { id: 'oceano', name: 'Océano', look: look({ background: { type: 'mesh', colors: ['#0b1d3a', '#1e6091', '#52b69a', '#d9ed92'] }, cards: { style: 'glass', radius: 16, shadow: 2 }, tracks: { foundation: '#d9ed92', discipline: '#34a0a4', choice: '#99d98c', approved: '#52b69a' } }) },
  { id: 'neon', name: 'Neón', look: look({ background: { type: 'linear', colors: ['#0f0c29', '#302b63', '#24243e', '#0f0c29'], angle: 160 }, texture: { type: 'grid', amount: 30 }, cards: { style: 'outline', radius: 6, shadow: 0 }, tracks: { foundation: '#ff4ecd', discipline: '#2de2e6', choice: '#f6f930', approved: '#39ff88' }, font: 'mono' }) },
  { id: 'bosque', name: 'Bosque', look: look({ background: { type: 'mesh', colors: ['#1b3a2b', '#2d6a4f', '#95d5b2', '#081c15'] }, texture: { type: 'grain', amount: 30 }, cards: { style: 'glass', radius: 12, shadow: 1 }, tracks: { foundation: '#e9c46a', discipline: '#74c69d', choice: '#b7e4c7', approved: '#52b788' } }) },
  { id: 'pastel', name: 'Pastel', look: look({ background: { type: 'mesh', colors: ['#ffd6e0', '#c1e1ff', '#d4f8d4', '#fff1c1'] }, cards: { radius: 20, shadow: 1, density: 'comfy' }, tracks: { foundation: '#e58fb0', discipline: '#6ea8e0', choice: '#8cc98c', approved: '#3fa37a' }, font: 'display' }) },
  { id: 'grafito', name: 'Grafito', look: look({ background: { type: 'solid', colors: ['#141414', '#1f1f1f', '#2a2a2a', '#000000'] }, texture: { type: 'dots', amount: 45 }, cards: { style: 'outline', radius: 10 }, tracks: { foundation: '#ffd166', discipline: '#a0a0a0', choice: '#6f6f6f', approved: '#7ee2a8' }, font: 'display' }) },
  { id: 'blueprint', name: 'Plano', look: look({ background: { type: 'solid', colors: ['#123a6b', '#0e2f57', '#1c4f8a', '#0a2340'] }, texture: { type: 'grid', amount: 55 }, cards: { style: 'outline', radius: 2, density: 'compact' }, tracks: { foundation: '#ffcf5c', discipline: '#7fb8ff', choice: '#4f86cc', approved: '#9ff0c0' }, font: 'mono' }) },
]

const HEX = /^#[0-9a-f]{6}$/i
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? value as T : fallback)
const clamp = (value: unknown, min: number, max: number, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback)
const color = (value: unknown, fallback: string) => (typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback)

/** Accepts anything (stored JSON, pasted data) and returns a valid look. */
export function sanitizeLook(value: unknown): Look {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, any>
  const bg = raw.background ?? {}, tx = raw.texture ?? {}, cards = raw.cards ?? {}, tracks = raw.tracks ?? {}
  const colors = Array.isArray(bg.colors) ? bg.colors.slice(0, 4) : []
  return {
    background: {
      type: pick(bg.type, ['none', 'solid', 'elliptic', 'linear', 'mesh'] as const, defaultLook.background.type),
      colors: defaultLook.background.colors.map((fallback, index) => color(colors[index], fallback)),
      angle: clamp(bg.angle, 0, 360, defaultLook.background.angle),
    },
    texture: { type: pick(tx.type, ['none', 'dots', 'grid', 'grain'] as const, 'none'), amount: clamp(tx.amount, 0, 100, defaultLook.texture.amount) },
    cards: {
      style: pick(cards.style, ['solid', 'glass', 'outline'] as const, 'solid'),
      radius: clamp(cards.radius, 0, 24, defaultLook.cards.radius),
      shadow: clamp(cards.shadow, 0, 3, 0),
      density: pick(cards.density, ['compact', 'normal', 'comfy'] as const, 'normal'),
    },
    tracks: {
      foundation: color(tracks.foundation, defaultLook.tracks.foundation),
      discipline: color(tracks.discipline, defaultLook.tracks.discipline),
      choice: color(tracks.choice, defaultLook.tracks.choice),
      approved: color(tracks.approved, defaultLook.tracks.approved),
    },
    font: pick(raw.font, ['system', 'display', 'mono', 'serif'] as const, 'system'),
  }
}

/** Relative luminance (WCAG) of a #rrggbb color. */
export function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The colors that actually cover the map for this background type. */
function visibleColors(background: Look['background']) {
  if (background.type === 'solid') return [background.colors[0]]
  if (background.type === 'elliptic') return [background.colors[2], background.colors[3], background.colors[1]]
  return background.colors
}

/** Whether text drawn straight on the background should be light. */
export function isDarkBackground(lookValue: Look) {
  if (lookValue.background.type === 'none') return null
  const colors = visibleColors(lookValue.background)
  return colors.reduce((sum, value) => sum + luminance(value), 0) / colors.length < 0.28
}

function backgroundLayers({ type, colors: [a, b, c, d], angle }: Look['background']): Layer[] {
  const cover = (image: string) => ({ image, size: '100% 100%' })
  switch (type) {
    case 'solid': return [cover(`linear-gradient(${a}, ${a})`)]
    case 'elliptic': return [cover(`radial-gradient(ellipse 60% 55% at 50% 45%, ${a} 0%, ${b} 28%, ${c} 62%, ${d} 100%)`)]
    case 'linear': return [cover(`linear-gradient(${angle}deg, ${a}, ${b}, ${c}, ${d})`)]
    case 'mesh': return [
      cover(`radial-gradient(at 12% 18%, ${a} 0px, transparent 55%)`),
      cover(`radial-gradient(at 88% 12%, ${b} 0px, transparent 55%)`),
      cover(`radial-gradient(at 82% 88%, ${c} 0px, transparent 55%)`),
      cover(`radial-gradient(at 18% 92%, ${d} 0px, transparent 55%)`),
      cover(`linear-gradient(${a}, ${c})`),
    ]
    default: return []
  }
}

type Layer = { image: string; size: string }

function textureImage({ type, amount }: Look['texture'], dark: boolean): Layer[] {
  const alpha = (amount / 100) * (dark ? 0.28 : 0.2)
  const ink = dark ? `rgba(255,255,255,${alpha.toFixed(3)})` : `rgba(0,0,0,${alpha.toFixed(3)})`
  switch (type) {
    case 'dots': return [{ image: `radial-gradient(${ink} 1.2px, transparent 1.4px)`, size: '18px 18px' }]
    case 'grid': return [{ image: `linear-gradient(${ink} 1px, transparent 1px)`, size: '28px 28px' }, { image: `linear-gradient(90deg, ${ink} 1px, transparent 1px)`, size: '28px 28px' }]
    case 'grain': {
      const opacity = (amount / 100) * 0.55
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${dark ? 1 : 0} 0 0 0 0 ${dark ? 1 : 0} 0 0 0 0 ${dark ? 1 : 0} 0 0 0 ${opacity.toFixed(2)} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`
      return [{ image: `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}")`, size: '160px 160px' }]
    }
    default: return []
  }
}

const fonts: Record<FontChoice, string> = {
  system: 'inherit',
  display: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  mono: "ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
}

const shadows = ['none', '0 1px 2px rgba(0,0,0,.08)', '0 6px 16px rgba(0,0,0,.14)', '0 14px 34px rgba(0,0,0,.24)']
const densities: Record<Density, { row: number; gap: number }> = { compact: { row: 104, gap: 12 }, normal: { row: 124, gap: 18 }, comfy: { row: 142, gap: 24 } }

/** CSS background for a small preview swatch of a look. */
export function previewBackground(value: Look) {
  const layers = [...textureImage(value.texture, Boolean(isDarkBackground(value))), ...backgroundLayers(value.background)]
  if (!layers.length) return ''
  return `background-image: ${layers.map((layer) => layer.image).join(', ')}; background-size: ${layers.map((layer) => (layer.size === '100% 100%' ? layer.size : layer.size.replace(/\d+px/g, (px) => `${Math.round(parseInt(px) / 2)}px`))).join(', ')};`
}

/** The stylesheet that applies a look to the map; empty for the default look. */
export function lookCss(value: Look) {
  const scope = '.curriculum-workspace'
  const dark = isDarkBackground(value)
  const rules: string[] = []
  const { tracks, cards, background, texture } = value
  rules.push(`${scope} { --map-foundation: ${tracks.foundation}; --map-discipline: ${tracks.discipline}; --map-choice: ${tracks.choice}; --map-approved: ${tracks.approved}; }`)
  rules.push(`${scope} .course-tile[data-status='disponible'] .course-status::before, ${scope} .course-tile[data-status='aprobada'] .course-status::before { background: var(--map-approved); }`)
  rules.push(`${scope} .course-tile[data-status='aprobada'] .course-status { color: var(--map-approved); }`)
  rules.push(`${scope} .course-tile[data-status='aprobada'] { background: color-mix(in srgb, var(--map-approved) 9%, var(--panel)); }`)
  if (background.type !== 'none') {
    const layers = [...textureImage(texture, Boolean(dark)), ...backgroundLayers(background)]
    rules.push(`${scope} .curriculum-grid { background-image: ${layers.map((layer) => layer.image).join(', ')}; background-size: ${layers.map((layer) => layer.size).join(', ')}; border-radius: 18px; padding: 18px 16px; box-sizing: content-box; }`)
    if (dark) rules.push(`${scope} .curriculum-column > header { color: #f5f5f5; border-bottom-color: rgba(255,255,255,.18); } ${scope} .curriculum-column > header > span { color: rgba(255,255,255,.7); } ${scope} .course-slot { color: rgba(255,255,255,.78); border-color: rgba(255,255,255,.3); } ${scope} .course-slot small { color: rgba(255,255,255,.6); }`)
  }
  rules.push(`${scope} .course-tile, ${scope} .course-slot { border-radius: ${cards.radius}px; }`)
  rules.push(`${scope} .course-tile { box-shadow: ${shadows[cards.shadow]}; }`)
  if (cards.style === 'glass') rules.push(`${scope} .course-tile { background: color-mix(in srgb, var(--panel) 62%, transparent); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); border-color: rgba(255,255,255,.35); } ${scope} .course-tile[data-status='aprobada'] { background: color-mix(in srgb, var(--map-approved) 16%, color-mix(in srgb, var(--panel) 62%, transparent)); }`)
  if (cards.style === 'outline') {
    const ink = dark ? '#f5f5f5' : '#111311'
    const muted = dark ? 'rgba(255,255,255,.66)' : 'rgba(17,19,17,.62)'
    rules.push(`${scope} .course-tile { --ink: ${ink}; --muted: ${muted}; background: transparent; border: 1.5px solid ${dark ? 'rgba(255,255,255,.34)' : 'rgba(0,0,0,.28)'}; border-top-width: 3px; } ${scope} .course-tile[data-status='aprobada'] { background: color-mix(in srgb, var(--map-approved) 14%, transparent); }`)
  }
  const density = densities[cards.density]
  if (cards.density !== 'normal') rules.push(`${scope} .curriculum-column { grid-template-rows: 52px repeat(5, ${density.row}px); gap: ${density.gap}px; } ${scope} .course-tile, ${scope} .course-slot { height: ${density.row}px; }`)
  if (value.font !== 'system') rules.push(`${scope} .course-name, ${scope} .curriculum-column > header > strong { font-family: ${fonts[value.font]}; }`)
  rules.push(`@media print { ${scope} .curriculum-grid { background: none !important; padding: 0 !important; } }`)
  return rules.join('\n')
}

export function loadLook(storage: Pick<Storage, 'getItem'> | undefined): Look {
  try {
    const raw = storage?.getItem(LOOK_KEY)
    return raw ? sanitizeLook(JSON.parse(raw)) : defaultLook
  } catch {
    return defaultLook
  }
}

export function saveLook(storage: Pick<Storage, 'setItem'> | undefined, value: Look) {
  try { storage?.setItem(LOOK_KEY, JSON.stringify(value)) } catch { /* private mode: the look still applies for this visit */ }
}

/** Injects (or updates) the stylesheet for the current look. */
export function applyLook(value: Look) {
  if (typeof document === 'undefined') return
  let style = document.getElementById('look-style') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'look-style'
    document.head.append(style)
  }
  style.textContent = lookCss(value)
}

/** A pleasant random look: harmonious hues, readable cards. */
export function randomLook(random = Math.random): Look {
  const hue = Math.floor(random() * 360)
  const hsl = (h: number, s: number, l: number) => {
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
      return Math.round(c * 255).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }
  const dark = random() < 0.5
  const types: BackgroundType[] = ['elliptic', 'linear', 'mesh', 'mesh', 'solid']
  const offsets = [0, 30 + random() * 40, 160 + random() * 40, 200 + random() * 60]
  const colors = offsets.map((offset, index) => hsl((hue + offset) % 360, 45 + random() * 40, dark ? 12 + index * 9 + random() * 10 : 92 - index * 9 - random() * 8))
  return sanitizeLook({
    background: { type: types[Math.floor(random() * types.length)], colors, angle: Math.floor(random() * 360) },
    texture: { type: (['none', 'grain', 'dots', 'grid'] as const)[Math.floor(random() * 4)], amount: 25 + Math.floor(random() * 45) },
    cards: { style: (['solid', 'glass', 'outline'] as const)[Math.floor(random() * 3)], radius: Math.floor(random() * 22), shadow: Math.floor(random() * 4), density: 'normal' },
    tracks: {
      foundation: hsl((hue + 40) % 360, 70, dark ? 68 : 42),
      discipline: hsl((hue + 190) % 360, 55, dark ? 66 : 40),
      choice: hsl((hue + 110) % 360, 35, dark ? 62 : 45),
      approved: hsl(145, 55, dark ? 60 : 36),
    },
    font: (['system', 'display', 'mono', 'serif'] as const)[Math.floor(random() * 4)],
  })
}
