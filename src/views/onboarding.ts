import { subjects } from '../data/curriculum'
import { referenceSemesters } from '../data/reference-layout'
import type { RequirementStatus } from '../domain/progress'
import { commit, navigate, store } from '../app/store'
import { icon } from '../ui/icons'

let step = 0
let semester = 1

/** Required courses drawn on the reference map before the given semester. */
export function coursesBefore(target: number) {
  const codes = new Set(referenceSemesters.slice(0, Math.max(0, target - 1)).flat().filter((cell): cell is string => typeof cell === 'string'))
  return subjects.filter((subject) => codes.has(subject.code))
}

export function shouldOnboard() {
  return !store.state.onboarded
}

const situations: { key: 'mathBasics' | 'literacy' | 'english'; label: string; options: [RequirementStatus, string][] }[] = [
  { key: 'mathBasics', label: 'Matemáticas básicas', options: [['no-aplica', 'No me la exigieron'], ['cumplida', 'Ya la aprobé'], ['pendiente', 'Debo cursarla']] },
  { key: 'literacy', label: 'Lectoescritura', options: [['no-aplica', 'No me la exigieron'], ['cumplida', 'Ya la aprobé'], ['pendiente', 'Debo cursarla']] },
  { key: 'english', label: 'Inglés', options: [['exento', 'Lo acredité'], ['pendiente', 'Debo cursar niveles']] },
]

function stepSituation() {
  const state = store.state
  return `<p>La universidad define estas nivelaciones al admitirte. La app no las supone: indícalas una vez.</p>${situations.map(({ key, label, options }) => `<fieldset class="onboarding-choice"><legend>${label}</legend>${options.map(([value, text]) => `<label><input type="radio" name="${key}" value="${value}"${state[key] === value ? ' checked' : ''} required /> ${text}</label>`).join('')}</fieldset>`).join('')}`
}

function stepProgress() {
  const count = coursesBefore(semester).length
  return `<p>Marca de una vez las materias obligatorias de los semestres anteriores. Luego puedes corregir cualquier materia en la malla o importar tu avance.</p><label class="onboarding-semester"><span>¿En qué semestre vas?</span><select data-onboarding-semester>${Array.from({ length: 10 }, (_, index) => index + 1).map((value) => `<option value="${value}"${value === semester ? ' selected' : ''}>${value === 1 ? 'Primer semestre (empiezo)' : `Semestre ${value}`}</option>`).join('')}</select></label><p class="onboarding-preview" aria-live="polite">${count ? `Se marcarán como aprobadas ${count} materias de los semestres 1 a ${semester - 1} de la malla de referencia.` : 'No se marcará ninguna materia.'}</p>`
}

function stepDone() {
  return `<ul class="onboarding-tips"><li>${icon('grid')}<span><strong>Malla:</strong> toca una materia para ver requisitos, grupos del SIA, notas y agregarla al plan.</span></li><li>${icon('route')}<span><strong>Planear:</strong> mira qué puedes inscribir y arma un horario sin choques con los grupos reales.</span></li><li>${icon('calendar')}<span><strong>Horario:</strong> ajusta tu semana y confirma cupos en el SIA antes de inscribir.</span></li></ul><p class="muted">Todo se guarda solo en este navegador. Exporta una copia desde el encabezado cuando quieras.</p>`
}

const steps = [
  { title: 'Tu situación', body: stepSituation },
  { title: 'Lo que ya aprobaste', body: stepProgress },
  { title: 'Listo para empezar', body: stepDone },
]

export function renderOnboarding() {
  if (!shouldOnboard()) return ''
  const current = steps[step]
  return `<dialog class="onboarding" aria-labelledby="onboarding-title"><form method="dialog" data-onboarding-form><header><span class="onboarding-step">Paso ${step + 1} de ${steps.length}</span><button type="button" class="text-button" data-onboarding-skip>Omitir</button></header><h2 id="onboarding-title">${current.title}</h2>${current.body()}<footer>${step ? '<button type="button" class="button button-quiet" data-onboarding-back>Atrás</button>' : '<span></span>'}<button type="submit" class="button button-solid">${step === steps.length - 1 ? 'Empezar' : 'Continuar'} ${icon('arrow')}</button></footer></form></dialog>`
}

function finish() {
  store.state.onboarded = true
  step = 0
  commit()
}

export function bindOnboarding(root: HTMLElement) {
  const dialog = root.querySelector<HTMLDialogElement>('.onboarding')
  if (!dialog) return
  if (!dialog.open) dialog.showModal()
  const form = dialog.querySelector<HTMLFormElement>('[data-onboarding-form]')!
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish() })
  dialog.querySelector('[data-onboarding-skip]')?.addEventListener('click', finish)
  dialog.querySelector('[data-onboarding-back]')?.addEventListener('click', () => { step = Math.max(0, step - 1); commit() })
  dialog.querySelector<HTMLSelectElement>('[data-onboarding-semester]')?.addEventListener('change', (event) => {
    semester = Number((event.target as HTMLSelectElement).value)
    const preview = dialog.querySelector('.onboarding-preview')
    const count = coursesBefore(semester).length
    if (preview) preview.textContent = count ? `Se marcarán como aprobadas ${count} materias de los semestres 1 a ${semester - 1} de la malla de referencia.` : 'No se marcará ninguna materia.'
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const state = store.state
    if (step === 0) {
      if (!form.reportValidity()) return
      const data = new FormData(form)
      for (const { key } of situations) state[key] = String(data.get(key)) as RequirementStatus
    }
    if (step === 1) {
      for (const subject of coursesBefore(semester)) if (state.notes[subject.id] === undefined) state.subjects[subject.id] = 'aprobada'
    }
    if (step === steps.length - 1) {
      store.view = semester > 1 ? 'plan' : 'malla'
      finish()
      if (semester > 1) navigate('plan')
      return
    }
    step += 1
    commit()
    dialog.querySelector<HTMLElement>('input, select, button[type="submit"]')?.focus()
  })
}
