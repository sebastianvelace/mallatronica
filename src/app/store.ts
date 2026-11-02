import { emptyState, parseState, type State, type Theme } from '../domain/state'
import { showToast } from '../ui/toast'

export type View = 'malla' | 'plan' | 'calculadora' | 'horario' | 'libre' | 'info'

const STATE_KEY = 'mallatronica-state-v2'

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    return raw ? parseState(JSON.parse(raw), systemTheme()) : emptyState(systemTheme())
  } catch {
    return emptyState(systemTheme())
  }
}

/** Persisted academic state plus ephemeral presentation state that survives rerenders. */
export const store = {
  state: loadState(),
  view: 'malla' as View,
  /** Course detail to reopen after an academic update. */
  pendingCourseId: undefined as string | undefined,
  /** Course to preselect when the schedule form opens. */
  pendingScheduleSubjectId: null as string | null,
  editingSlotId: null as string | null,
  freeChoiceQuery: '',
  freeChoiceCategory: 'all',
  /** Disclosure panels stay open across full rerenders. */
  openPanels: new Set<string>(),
}

let renderer = () => {}
let storageWarningShown = false

export function setRenderer(next: () => void) {
  renderer = next
}

export function render() {
  renderer()
}

export function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(store.state))
  } catch {
    // Private mode or a full quota must not break the current session.
    if (!storageWarningShown) {
      storageWarningShown = true
      queueMicrotask(() => showToast('No se pudo guardar', 'Tu navegador bloqueó el almacenamiento local. Exporta tu avance para no perderlo.'))
    }
  }
}

/** Saves and rerenders after an academic change. */
export function commit() {
  saveState()
  renderer()
}

export function navigate(view: View) {
  store.view = view
  renderer()
}
