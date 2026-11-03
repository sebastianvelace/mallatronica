import { navigate, store, type View } from '../app/store'

/**
 * Guided tour: dims the whole app except the element being explained, with a card
 * that says what it is and how to move on. The overlay lives outside #app, so the
 * app can rerender underneath; targets are looked up again on every step.
 */
export type TourStep = {
  /** CSS selectors tried in order; the first visible match is highlighted. */
  targets: string[]
  title: string
  body: string
  view?: View
}

export const tourSteps: TourStep[] = [
  {
    targets: ['.workspace-nav'],
    title: 'Tus cinco herramientas',
    body: 'Malla, Planear, Notas, Horario y Libre elección comparten tu avance: lo que marcas en una se refleja en todas.',
    view: 'malla',
  },
  {
    targets: ['.curriculum-metrics'],
    title: 'Tu avance de un vistazo',
    body: 'Aquí ves tu PAPA estimado y cuántos de los 172 créditos llevas. Se actualiza solo cada vez que marcas una materia o registras una nota.',
    view: 'malla',
  },
  {
    targets: ['.course-tile[data-status="disponible"]', '.course-tile[data-status="parcial"]', '.course-tile'],
    title: 'Toca una materia',
    body: 'Cada tarjeta te dice si ya la puedes inscribir. Al tocarla ves sus prerrequisitos, los grupos del SIA, y puedes marcarla como aprobada, ponerle nota o agregarla a tu plan.',
    view: 'malla',
  },
  {
    targets: ['.board-tabs'],
    title: 'Filtra la malla',
    body: 'Usa “Disponibles” para ver solo lo que puedes inscribir ahora mismo.',
    view: 'malla',
  },
  {
    targets: ['.workspace-nav [data-view="plan"]'],
    title: 'Planea el próximo semestre',
    body: 'Te muestra lo que tus requisitos permiten inscribir y qué materias se habilitan si apruebas tu plan.',
  },
  {
    targets: ['.workspace-nav [data-view="horario"]'],
    title: 'Arma tu horario',
    body: 'Elige grupos reales del SIA, con profesor, salón y cupos. Los choques aparecen antes de que inscribas.',
  },
  {
    targets: ['.workspace-nav [data-view="calculadora"]'],
    title: 'Registra tus notas',
    body: 'Calcula tu PAPA con la misma ponderación por créditos y mantiene tu malla al día.',
  },
  {
    targets: ['.workspace-nav [data-view="libre"]'],
    title: 'Libre elección',
    body: 'Guarda las materias que te interesan, lleva la cuenta de esos créditos y pásalas al horario.',
  },
  {
    targets: ['[data-action="export"]'],
    title: 'Tu avance es tuyo',
    body: 'Todo se guarda en este navegador, sin cuentas. Exporta una copia para llevarla a otro equipo o tener respaldo.',
  },
  {
    targets: ['.workspace-nav [data-view="info"]'],
    title: '¿Lo quieres repetir?',
    body: 'En Ayuda puedes volver a ver este recorrido cuando quieras. ¡Listo, a planear!',
  },
]

let active: { close: (completed: boolean) => void } | null = null

export function isTourActive() {
  return active !== null
}

function visible(element: Element) {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function findTarget(step: TourStep) {
  for (const selector of step.targets) {
    const match = [...document.querySelectorAll<HTMLElement>(selector)].find(visible)
    if (match) return match
  }
  return null
}

/** Card position next to the highlighted rectangle, kept inside the viewport. */
export function placeCard(target: { top: number; left: number; width: number; height: number }, card: { width: number; height: number }, viewport: { width: number; height: number }, gap = 16) {
  const margin = 12
  const below = target.top + target.height + gap
  const above = target.top - gap - card.height
  let top: number
  if (below + card.height <= viewport.height - margin) top = below
  else if (above >= margin) top = above
  else top = Math.max(margin, viewport.height - card.height - margin)
  const centered = target.left + target.width / 2 - card.width / 2
  const left = Math.min(Math.max(margin, centered), Math.max(margin, viewport.width - card.width - margin))
  return { top, left }
}

export function startTour(steps: TourStep[] = tourSteps, onDone?: (completed: boolean) => void) {
  if (active) return
  const app = document.querySelector<HTMLElement>('#app')
  const previousFocus = document.activeElement as HTMLElement | null
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let index = 0
  let frame = 0

  const root = document.createElement('div')
  root.className = 'tour'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'tour-title')
  root.setAttribute('aria-describedby', 'tour-body')
  root.innerHTML = `
    <div class="tour-blocker"></div>
    <div class="tour-spotlight" aria-hidden="true"></div>
    <section class="tour-card">
      <div class="tour-top"><span class="tour-count" data-tour-count></span><button type="button" class="tour-skip" data-tour-skip>Saltar recorrido</button></div>
      <div class="tour-progress" aria-hidden="true"><i data-tour-bar></i></div>
      <h2 id="tour-title" data-tour-title></h2>
      <p id="tour-body" data-tour-body aria-live="polite"></p>
      <div class="tour-actions">
        <button type="button" class="tour-back" data-tour-back>Atrás</button>
        <button type="button" class="tour-next" data-tour-next></button>
      </div>
      <p class="tour-keys" aria-hidden="true">Usa ← → para moverte · Esc para salir</p>
    </section>`
  document.body.append(root)
  app?.setAttribute('inert', '')
  document.documentElement.classList.add('tour-open')

  const spotlight = root.querySelector<HTMLElement>('.tour-spotlight')!
  const card = root.querySelector<HTMLElement>('.tour-card')!
  const next = root.querySelector<HTMLButtonElement>('[data-tour-next]')!
  const back = root.querySelector<HTMLButtonElement>('[data-tour-back]')!

  const position = () => {
    const target = findTarget(steps[index])
    const pad = 8
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    if (!target) {
      spotlight.style.cssText = `top:${viewport.height / 2}px;left:${viewport.width / 2}px;width:0;height:0`
      const { width, height } = card.getBoundingClientRect()
      card.style.top = `${Math.max(12, (viewport.height - height) / 2)}px`
      card.style.left = `${Math.max(12, (viewport.width - width) / 2)}px`
      return
    }
    const rect = target.getBoundingClientRect()
    const box = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    spotlight.style.cssText = `top:${box.top}px;left:${box.left}px;width:${box.width}px;height:${box.height}px`
    const { width, height } = card.getBoundingClientRect()
    const place = placeCard(box, { width, height }, viewport)
    card.style.top = `${place.top}px`
    card.style.left = `${place.left}px`
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position) }

  const show = (to: number) => {
    index = Math.min(Math.max(0, to), steps.length - 1)
    const step = steps[index]
    if (step.view && store.view !== step.view) navigate(step.view)
    const target = findTarget(step)
    if (target) {
      const rect = target.getBoundingClientRect()
      if (rect.top < 80 || rect.bottom > window.innerHeight - 80) target.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    }
    root.querySelector('[data-tour-count]')!.textContent = `${index + 1} de ${steps.length}`
    root.querySelector('[data-tour-title]')!.textContent = step.title
    root.querySelector('[data-tour-body]')!.textContent = step.body
    root.querySelector<HTMLElement>('[data-tour-bar]')!.style.width = `${((index + 1) / steps.length) * 100}%`
    back.hidden = index === 0
    next.innerHTML = index === steps.length - 1 ? 'Terminar' : 'Siguiente <span aria-hidden="true">→</span>'
    position()
    // Smooth scrolling moves the target after we measured; follow it for a moment.
    if (!reduced) for (const delay of [120, 260, 420, 600]) setTimeout(schedule, delay)
    next.focus({ preventScroll: true })
  }

  const close = (completed: boolean) => {
    if (!active) return
    active = null
    cancelAnimationFrame(frame)
    removeEventListener('resize', schedule)
    removeEventListener('scroll', schedule, true)
    document.removeEventListener('keydown', onKey, true)
    app?.removeAttribute('inert')
    document.documentElement.classList.remove('tour-open')
    root.remove()
    previousFocus?.focus?.({ preventScroll: true })
    onDone?.(completed)
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); close(false) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); if (index < steps.length - 1) show(index + 1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1) }
    else if (event.key === 'Tab') {
      // Keep focus inside the card.
      const focusable = [...card.querySelectorAll<HTMLButtonElement>('button:not([hidden])')]
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }

  next.addEventListener('click', () => (index === steps.length - 1 ? close(true) : show(index + 1)))
  back.addEventListener('click', () => show(index - 1))
  root.querySelector('[data-tour-skip]')!.addEventListener('click', () => close(false))
  addEventListener('resize', schedule)
  addEventListener('scroll', schedule, true)
  document.addEventListener('keydown', onKey, true)

  active = { close }
  show(0)
}
