import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import './landing.css'
import graph from './graph.json'
import { describeStatus, hasSavedProgress, type SiaStatus } from './logic'

document.documentElement.classList.add('js')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

/* Header gains a background once the page scrolls. */
const header = document.querySelector<HTMLElement>('[data-header]')
const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 12)
addEventListener('scroll', onScroll, { passive: true })
onScroll()

/* Returning visitors pick up where they left off. */
let storage: Storage | undefined
try { storage = localStorage } catch { storage = undefined }
if (hasSavedProgress(storage)) {
  document.querySelectorAll<HTMLAnchorElement>('[data-continue]').forEach((link) => { link.innerHTML = 'Continuar donde ibas <span aria-hidden="true">→</span>' })
  document.querySelector<HTMLElement>('[data-saved]')?.removeAttribute('hidden')
}

/* Warm up the app before the click so it opens instantly. */
let prefetched = false
const prefetchApp = () => {
  if (prefetched) return
  prefetched = true
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = '/app'
  document.head.append(link)
}
document.querySelectorAll('[data-app-link]').forEach((link) => {
  link.addEventListener('pointerenter', prefetchApp, { once: true })
  link.addEventListener('touchstart', prefetchApp, { once: true, passive: true })
  link.addEventListener('focus', prefetchApp, { once: true })
})

/* Live SIA status: hidden unless the last refresh published. */
fetch('/api/sia/status', { signal: AbortSignal.timeout(5000) })
  .then((response) => (response.ok ? response.json() as Promise<SiaStatus> : null))
  .then((status) => {
    const summary = describeStatus(status)
    if (!summary) return
    const live = document.querySelector<HTMLElement>('[data-live]')
    const text = document.querySelector<HTMLElement>('[data-live-text]')
    if (live && text) { text.textContent = summary.badge; live.hidden = false }
    const set = (key: string, value: string | number | undefined) => {
      const element = document.querySelector<HTMLElement>(`[data-stat="${key}"]`)
      if (!element || value === undefined) return
      element.textContent = String(value)
      element.closest<HTMLElement>('.stat')?.removeAttribute('hidden')
    }
    set('updated', summary.updated)
    set('courses', summary.courses)
    set('groups', summary.groups)
  })
  .catch(() => {})

/* Marquee: real course names, duplicated so the loop is seamless. */
const names = graph.names
const half = Math.ceil(names.length / 2)
document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((row) => {
  const list = row.dataset.marquee === '0' ? names.slice(0, half) : names.slice(half)
  const pills = list.map((name) => `<span class="pill">${name.replace(/[&<>]/g, '')}</span>`).join('')
  row.innerHTML = pills + (reducedMotion ? '' : pills.replace(/class="pill"/g, 'class="pill" aria-hidden="true"'))
})

/* Feature tabs (WAI-ARIA tabs pattern with arrow keys). */
const tablist = document.querySelector<HTMLElement>('[data-tabs]')
if (tablist) {
  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const other of tabs) {
      const active = other === tab
      other.setAttribute('aria-selected', String(active))
      other.tabIndex = active ? 0 : -1
      document.getElementById(other.getAttribute('aria-controls')!)!.hidden = !active
    }
    if (focus) tab.focus()
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (event) => {
      const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index }
      if (!(event.key in moves)) return
      event.preventDefault()
      select(tabs[(index + moves[event.key] + tabs.length) % tabs.length], true)
    })
  })
}

/* Reveal on scroll. */
const revealables = document.querySelectorAll('.reveal')
if (reducedMotion || !('IntersectionObserver' in window)) revealables.forEach((element) => element.classList.add('visible'))
else {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target) }
  }), { rootMargin: '0px 0px -8% 0px' })
  revealables.forEach((element) => observer.observe(element))
}

/* Constellation: the real prerequisite network of plan 2545, drifting slowly. */
const canvas = document.querySelector<HTMLCanvasElement>('[data-constellation]')
const context = canvas?.getContext('2d')
if (canvas && context) {
  type Point = { x: number; y: number; core: boolean; phase: number }
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const points: Point[] = graph.nodes.map(([x, y, core]) => ({ x, y, core: core === 1, phase: random() * Math.PI * 2 }))
  const dust = Array.from({ length: 34 }, () => ({ x: random(), y: random(), phase: random() * Math.PI * 2 }))
  let width = 0, height = 0, visible = true, frame = 0, last = 0

  const resize = () => {
    const ratio = Math.min(devicePixelRatio || 1, 2)
    width = canvas.clientWidth; height = canvas.clientHeight
    canvas.width = width * ratio; canvas.height = height * ratio
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    draw(0)
  }
  const place = (p: { x: number; y: number; phase: number }, t: number) => {
    const wide = width > 700
    const padX = wide ? width * 0.06 : 16, padY = height * 0.12
    const drift = reducedMotion ? 0 : 6
    return [padX + p.x * (width - padX * 2) + Math.sin(t / 3200 + p.phase) * drift, padY + p.y * (height - padY * 2) + Math.cos(t / 4100 + p.phase) * drift]
  }
  function draw(t: number) {
    context!.clearRect(0, 0, width, height)
    const positions = points.map((p) => place(p, t))
    context!.lineWidth = 1
    context!.strokeStyle = 'rgba(10,10,10,.09)'
    context!.beginPath()
    for (const [from, to] of graph.edges) {
      context!.moveTo(positions[from][0], positions[from][1])
      context!.lineTo(positions[to][0], positions[to][1])
    }
    context!.stroke()
    positions.forEach(([x, y], index) => {
      context!.fillStyle = points[index].core ? 'rgba(10,10,10,.32)' : 'rgba(10,10,10,.18)'
      context!.beginPath(); context!.arc(x, y, points[index].core ? 2.4 : 1.8, 0, Math.PI * 2); context!.fill()
    })
    context!.fillStyle = 'rgba(10,10,10,.12)'
    for (const speck of dust) {
      const [x, y] = place(speck, t * 0.7)
      context!.beginPath(); context!.arc(x, y, 1.3, 0, Math.PI * 2); context!.fill()
    }
  }
  const loop = (t: number) => {
    frame = requestAnimationFrame(loop)
    if (t - last < 33) return // ~30 fps is plenty for a slow drift
    last = t
    draw(t)
  }
  resize()
  addEventListener('resize', resize)
  if (!reducedMotion) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      cancelAnimationFrame(frame)
      if (visible) frame = requestAnimationFrame(loop)
    }).observe(canvas)
  }
}
