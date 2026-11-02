import { subjects } from '../data/curriculum'
import { getMissingRequirements, isFreeChoiceApproved } from '../app/selectors'
import { commit, store } from '../app/store'
import { showToast } from '../ui/toast'

/** Parses a grade input; returns null when the value is invalid and was restored. */
function readGradeInput(input: HTMLInputElement, previous: number | undefined): number | undefined | null {
  const value = input.value === '' ? undefined : Number(input.value)
  if (value !== undefined && (!input.checkValidity() || !Number.isFinite(value))) {
    input.reportValidity()
    input.value = previous?.toFixed(1) ?? ''
    return null
  }
  return value === undefined ? undefined : Math.round((value + Number.EPSILON) * 10) / 10
}

/** Grade inputs appear in the map (levelation), the calculator and free-choice cards. */
export function bindGradeInputs(root: HTMLElement) {
  const state = store.state
  root.querySelectorAll<HTMLInputElement>('[data-note]').forEach((input) => input.addEventListener('change', () => {
    const id = input.dataset.note!
    const value = readGradeInput(input, state.notes[id])
    if (value === null) return
    if (value === undefined) {
      delete state.notes[id]
      // Without the grade, the derived situation is unknown again; it must not stay "cumplida".
      if (id === 'matematicas-basicas') state.mathBasics = 'sin-definir'
      if (id === 'lecto-escritura') state.literacy = 'sin-definir'
    } else {
      state.notes[id] = value
      delete state.subjects[id]
      if (id === 'matematicas-basicas') state.mathBasics = value >= 3 ? 'cumplida' : 'pendiente'
      if (id === 'lecto-escritura') state.literacy = value >= 3 ? 'cumplida' : 'pendiente'
    }
    const subject = subjects.find((item) => item.id === id)
    const inconsistent = value !== undefined && subject !== undefined && getMissingRequirements(subject).length > 0
    commit()
    if (inconsistent) showToast('Nota guardada como historial', 'La materia tiene requisitos sin registrar. Revisa equivalencias o completa el avance anterior.')
  }))
  root.querySelectorAll<HTMLInputElement>('[data-free-note]').forEach((input) => input.addEventListener('change', () => {
    const id = input.dataset.freeNote!
    if (!state.freeChoice.some(course => course.id === id)) return
    const value = readGradeInput(input, state.freeChoiceNotes[id])
    if (value === null) return
    if (value === undefined) delete state.freeChoiceNotes[id]
    else {
      state.freeChoiceNotes[id] = value
      delete state.freeChoiceStatus[id]
    }
    commit()
  }))
  root.querySelectorAll<HTMLButtonElement>('[data-free-approved]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.freeApproved!
    const course = state.freeChoice.find(item => item.id === id)
    if (!course || state.freeChoiceNotes[id] !== undefined) return
    state.freeChoiceStatus[id] = isFreeChoiceApproved(course) ? 'pendiente' : 'aprobada'
    commit()
  }))
}
