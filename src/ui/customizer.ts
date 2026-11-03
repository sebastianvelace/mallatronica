import { applyLook, defaultLook, loadLook, presets, previewBackground, randomLook, sanitizeLook, saveLook, type Look } from './look'

/**
 * Side panel to personalize the map, with live preview. It lives outside #app so the
 * app can rerender behind it; every change applies instantly and is saved locally.
 */
let panel: HTMLElement | null = null
let current: Look = defaultLook
let previousFocus: HTMLElement | null = null
let saveTimer = 0

const storage = () => { try { return localStorage } catch { return undefined } }

export function initLook() {
  current = loadLook(storage())
  applyLook(current)
}

function segmented(path: string, value: string, options: [string, string][], label: string) {
  return `<div class="cz-segmented" role="radiogroup" aria-label="${label}">${options.map(([key, text]) => `<button type="button" role="radio" aria-checked="${key === value}" data-set="${path}" data-value="${key}">${text}</button>`).join('')}</div>`
}

function range(path: string, value: number, min: number, max: number, label: string, unit = '') {
  return `<label class="cz-range"><span>${label}</span><input type="range" min="${min}" max="${max}" value="${value}" data-set="${path}" data-number /><output>${value}${unit}</output></label>`
}

function colorInput(path: string, value: string, label: string) {
  return `<label class="cz-color"><input type="color" value="${value}" data-set="${path}" aria-label="${label}" /><span><strong>${label}</strong><small>${value.toUpperCase()}</small></span></label>`
}

function matchesPreset(look: Look) {
  const json = JSON.stringify(look)
  return presets.find((preset) => JSON.stringify(preset.look) === json)?.id ?? null
}

function body() {
  const look = current
  const bg = look.background
  const shown = bg.type === 'solid' ? 1 : 4
  const active = matchesPreset(look)
  const colorNames = bg.type === 'elliptic' ? ['Centro', 'Brillo', 'Halo', 'Borde'] : bg.type === 'solid' ? ['Color'] : ['Color 1', 'Color 2', 'Color 3', 'Color 4']
  return `
    <section class="cz-section">
      <h3>Estilos</h3>
      <div class="cz-presets">${presets.map((preset) => `<button type="button" class="cz-preset" data-preset="${preset.id}" aria-pressed="${active === preset.id}"><span class="cz-swatch" style="${previewBackground(preset.look)}"><i style="border-top-color:${preset.look.tracks.foundation}"></i><i style="border-top-color:${preset.look.tracks.discipline}"></i><i style="border-top-color:${preset.look.tracks.choice}"></i></span><span>${preset.name}</span></button>`).join('')}</div>
    </section>
    <section class="cz-section">
      <h3>Fondo</h3>
      ${segmented('background.type', bg.type, [['none', 'Ninguno'], ['solid', 'Liso'], ['elliptic', 'Luz elíptica'], ['linear', 'Lineal'], ['mesh', 'Malla']], 'Tipo de fondo')}
      ${bg.type === 'none' ? '<p class="cz-hint">Elige un tipo de fondo para darle color a la malla.</p>' : `<div class="cz-colors">${bg.colors.slice(0, shown).map((value, index) => colorInput(`background.colors.${index}`, value, colorNames[index])).join('')}</div>`}
      ${bg.type === 'linear' ? range('background.angle', bg.angle, 0, 360, 'Ángulo', '°') : ''}
    </section>
    <section class="cz-section">
      <h3>Textura</h3>
      ${segmented('texture.type', look.texture.type, [['none', 'Ninguna'], ['grain', 'Grano'], ['dots', 'Puntos'], ['grid', 'Cuadrícula']], 'Textura')}
      ${look.texture.type !== 'none' ? range('texture.amount', look.texture.amount, 0, 100, 'Intensidad', '%') : ''}
      ${look.texture.type !== 'none' && bg.type === 'none' ? '<p class="cz-hint">La textura se ve sobre un fondo.</p>' : ''}
    </section>
    <section class="cz-section">
      <h3>Tarjetas</h3>
      ${segmented('cards.style', look.cards.style, [['solid', 'Sólida'], ['glass', 'Vidrio'], ['outline', 'Contorno']], 'Estilo de tarjeta')}
      ${range('cards.radius', look.cards.radius, 0, 24, 'Redondeo', ' px')}
      ${range('cards.shadow', look.cards.shadow, 0, 3, 'Sombra')}
      ${segmented('cards.density', look.cards.density, [['compact', 'Compacta'], ['normal', 'Normal'], ['comfy', 'Amplia']], 'Densidad')}
    </section>
    <section class="cz-section">
      <h3>Colores</h3>
      <div class="cz-colors">${colorInput('tracks.foundation', look.tracks.foundation, 'Fundamentación')}${colorInput('tracks.discipline', look.tracks.discipline, 'Disciplinar')}${colorInput('tracks.choice', look.tracks.choice, 'Elección')}${colorInput('tracks.approved', look.tracks.approved, 'Aprobada')}</div>
    </section>
    <section class="cz-section">
      <h3>Tipografía</h3>
      ${segmented('font', look.font, [['system', 'Sistema'], ['display', 'Grotesca'], ['serif', 'Serif'], ['mono', 'Mono']], 'Tipografía')}
    </section>`
}

/** Returns a copy of the look with the value at a dotted path replaced. */
export function setPath(look: Look, path: string, value: unknown): Look {
  const copy = JSON.parse(JSON.stringify(look))
  const keys = path.split('.')
  let target = copy
  for (const key of keys.slice(0, -1)) target = target[key]
  target[keys[keys.length - 1]] = value
  return sanitizeLook(copy)
}

function update(next: Look, rerender: boolean) {
  current = next
  applyLook(current)
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => saveLook(storage(), current), 250)
  if (rerender) renderBody()
}

function renderBody() {
  if (!panel) return
  const scroller = panel.querySelector<HTMLElement>('.cz-body')!
  const scroll = scroller.scrollTop
  const focusedPath = (document.activeElement as HTMLElement | null)?.dataset?.set
  const focusedValue = (document.activeElement as HTMLElement | null)?.dataset?.value
  scroller.innerHTML = body()
  scroller.scrollTop = scroll
  if (focusedPath) {
    const selector = focusedValue ? `[data-set="${focusedPath}"][data-value="${focusedValue}"]` : `[data-set="${focusedPath}"]`
    scroller.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
  }
}

export function isCustomizerOpen() {
  return panel !== null
}

export function closeCustomizer() {
  if (!panel) return
  saveLook(storage(), current)
  panel.remove()
  panel = null
  document.removeEventListener('keydown', onKey, true)
  document.documentElement.classList.remove('customizer-open')
  previousFocus?.focus?.({ preventScroll: true })
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeCustomizer() }
}

export function openCustomizer() {
  if (panel) return
  previousFocus = document.activeElement as HTMLElement | null
  panel = document.createElement('aside')
  panel.className = 'customizer'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-labelledby', 'customizer-title')
  panel.innerHTML = `
    <header class="cz-head"><div><span class="cz-eyebrow">Malla</span><h2 id="customizer-title">Personalizar</h2></div><button type="button" class="cz-close" data-cz-close aria-label="Cerrar personalización">×</button></header>
    <div class="cz-body"></div>
    <footer class="cz-foot"><button type="button" data-cz-random>Sorpréndeme</button><button type="button" data-cz-reset>Restablecer</button><button type="button" class="cz-done" data-cz-close>Listo</button></footer>`
  document.body.append(panel)
  document.documentElement.classList.add('customizer-open')
  renderBody()

  panel.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button')
    if (!target) return
    if (target.matches('[data-cz-close]')) return closeCustomizer()
    if (target.matches('[data-cz-random]')) return update(randomLook(), true)
    if (target.matches('[data-cz-reset]')) return update(defaultLook, true)
    if (target.dataset.preset) return update(presets.find((preset) => preset.id === target.dataset.preset)!.look, true)
    if (target.dataset.set && target.dataset.value) update(setPath(current, target.dataset.set, target.dataset.value), true)
  })
  panel.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement
    if (!input.dataset.set) return
    const value = input.dataset.number !== undefined ? Number(input.value) : input.value
    update(setPath(current, input.dataset.set, value), false)
    const output = input.parentElement?.querySelector('output, small')
    if (output) output.textContent = input.type === 'color' ? input.value.toUpperCase() : `${input.value}${output.textContent?.replace(/^[\d-]+/, '') ?? ''}`
    // Preset highlight follows manual edits.
    const active = matchesPreset(current)
    panel?.querySelectorAll<HTMLElement>('[data-preset]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.preset === active)))
  })
  document.addEventListener('keydown', onKey, true)
  panel.querySelector<HTMLElement>('.cz-close')?.focus()
}
