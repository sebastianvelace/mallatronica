import './style.css'
import { loadOffer } from './data/sia-offer'
import { emptyState, isProgressFile, parseState } from './domain/state'
import { commit, navigate, setRenderer, store, type View } from './app/store'
import { icon } from './ui/icons'
import { showToast } from './ui/toast'
import { bindFreeChoice, renderFreeChoice } from './views/free-choice'
import { bindGradeInputs } from './views/grade-inputs'
import { bindCalculator, renderCalculator } from './views/calculator'
import { renderInfo } from './views/info'
import { bindMalla, renderMalla } from './views/malla'
import { bindOnboarding, renderOnboarding } from './views/onboarding'
import { bindPlanner, renderPlanner } from './views/planner'
import { bindSchedule, renderSchedule } from './views/schedule'

const app = document.querySelector<HTMLDivElement>('#app')!
let disposeView = () => {}

const views: Record<View, { render: () => string; bind?: (root: HTMLElement) => (() => void) | void }> = {
  malla: { render: renderMalla, bind: bindMalla },
  plan: { render: renderPlanner, bind: bindPlanner },
  calculadora: { render: renderCalculator, bind: bindCalculator },
  horario: { render: renderSchedule, bind: bindSchedule },
  libre: { render: renderFreeChoice, bind: bindFreeChoice },
  info: { render: renderInfo },
}

function navItem(view: View, svg: string, label: string, accessibleLabel: string) {
  const active = store.view === view
  return `<button class="workspace-nav-item ${active ? 'active' : ''}" data-view="${view}" aria-label="${accessibleLabel}"${active ? ' aria-current="page"' : ''}>${svg}<span>${label}</span></button>`
}

function render() {
  disposeView()
  const view = views[store.view]
  document.documentElement.dataset.theme = store.state.theme
  app.innerHTML = `
    <div class="workspace-shell">
      <main class="main-content">
        <header class="workspace-header">
          <div class="workspace-brand"><span class="brand-name">mallatrónica</span><span class="workspace-campus">UNAL · Bogotá</span></div>
          <nav class="workspace-nav" aria-label="Navegación principal">
            ${navItem('malla', icon('grid'), 'Malla', 'Malla curricular')}
            ${navItem('plan', icon('route'), 'Planear', 'Planear el próximo semestre')}
            ${navItem('calculadora', icon('calculator'), 'Notas', 'Notas y promedio')}
            ${navItem('horario', icon('calendar'), 'Horario', 'Horario semanal')}
            ${navItem('libre', icon('book'), 'Libre elección', 'Libre elección')}
            ${navItem('info', icon('info'), 'Ayuda', 'Fuentes y ayuda')}
          </nav>
          <div class="workspace-actions">
            <a class="github-link" href="https://github.com/sebastianvelace/mallatronica" target="_blank" rel="noopener noreferrer" aria-label="Ver el código y contribuir en GitHub (abre otra pestaña)">GitHub ${icon('arrow')}</a>
            <button data-action="theme" aria-label="Cambiar tema" title="Cambiar tema">${icon('sun')}</button>
            <button data-action="export" aria-label="Exportar avance" title="Exportar avance">${icon('download')}<span>Exportar</span></button>
          </div>
        </header>
        ${view.render()}
      </main>
    </div>
    <input type="file" id="import-file" accept="application/json" hidden />
    <input type="file" id="catalog-file" accept="application/json" hidden />
    ${renderOnboarding()}
  `
  bindShell()
  bindGradeInputs(app)
  disposeView = view.bind?.(app) ?? (() => {})
  bindOnboarding(app)
}

/** Controls shared by every view: navigation, theme, disclosures, export/import and reset. */
function bindShell() {
  app.querySelectorAll<HTMLElement>('[data-view]').forEach((element) => element.addEventListener('click', () => navigate(element.dataset.view as View)))
  app.querySelector<HTMLElement>('[data-action="theme"]')?.addEventListener('click', () => {
    store.state.theme = store.state.theme === 'dark' ? 'light' : 'dark'
    commit()
  })
  app.querySelectorAll<HTMLDetailsElement>('details[data-panel]').forEach((details) => details.addEventListener('toggle', () => {
    if (details.open) store.openPanels.add(details.dataset.panel!)
    else store.openPanels.delete(details.dataset.panel!)
  }))
  app.querySelector<HTMLElement>('[data-action="reset"]')?.addEventListener('click', () => {
    if (!window.confirm('¿Borrar todo el avance local, la configuración personal, el catálogo de libre elección y el horario? El tema visual se conservará.')) return
    store.state = emptyState(store.state.theme)
    store.editingSlotId = null
    commit()
  })
  app.querySelector<HTMLElement>('[data-action="export"]')?.addEventListener('click', exportState)
  app.querySelector<HTMLElement>('[data-action="import"]')?.addEventListener('click', () => app.querySelector<HTMLInputElement>('#import-file')?.click())
  app.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', importState)
}

function exportState() {
  const blob = new Blob([JSON.stringify({ ...store.state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `mallatronica-avance-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url)
}

function importState(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    input.value = ''
    let imported: unknown
    try {
      imported = JSON.parse(String(reader.result))
    } catch {
      imported = undefined
    }
    if (!isProgressFile(imported)) {
      showToast('No se pudo importar', 'Ese archivo no tiene un formato de avance válido.')
      return
    }
    if (!window.confirm('¿Reemplazar tu avance actual por el del archivo? Exporta primero una copia si quieres conservarlo.')) return
    store.state = parseState(imported, store.state.theme)
    store.editingSlotId = null
    commit()
    showToast('Avance importado', 'Tu avance se reemplazó con el archivo seleccionado.')
  }
  reader.readAsText(file)
}

setRenderer(render)
render()
// The SIA offer arrives as its own chunk; rerender once without losing focus or scroll.
loadOffer().then(() => {
  const active = document.activeElement?.id
  const scroll = window.scrollY
  render()
  window.scrollTo(0, scroll)
  if (active) document.getElementById(active)?.focus({ preventScroll: true })
}).catch(() => {})

// Offline support only in production builds, so development never serves stale files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
