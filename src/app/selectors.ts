import { supportSubjects, type Subject } from '../data/curriculum'
import type { CatalogCourse } from '../domain/catalog'
import { courseStatus, isApproved as isApprovedIn, isFreeChoiceApproved as isFreeChoiceApprovedIn, missingRequirements, prerequisiteGroupSatisfied, type CourseStatus, type Status } from '../domain/progress'
import { store } from './store'

/** Eligibility helpers bound to the current store state. */
export function isApproved(subject: { id: string }) {
  return isApprovedIn(store.state, subject)
}

export function isFreeChoiceApproved(course: CatalogCourse) {
  return isFreeChoiceApprovedIn(store.state, course)
}

export function getMissingRequirements(subject: Subject) {
  return missingRequirements(store.state, subject)
}

export function canApprove(subject: Subject) {
  return getMissingRequirements(subject).length === 0
}

export function getStatus(subject: Subject) {
  return courseStatus(store.state, subject)
}

export function supportStatus(id: string): Status | 'exento' | 'disponible' | 'bloqueada' {
  const state = store.state
  if (id === 'matematicas-basicas' || id === 'lecto-escritura') {
    const situation = id === 'matematicas-basicas' ? state.mathBasics : state.literacy
    if (state.notes[id] !== undefined) return state.notes[id] >= 3 ? 'aprobada' : 'reprobada'
    if (situation === 'cumplida') return 'aprobada'
    if (situation === 'exento' || situation === 'no-aplica') return 'exento'
    return 'pendiente'
  }
  if (state.english === 'exento' || state.english === 'no-aplica') return 'exento'
  const support = supportSubjects.find((item) => item.id === id)!
  if (state.subjects[id] === 'aprobada') return 'aprobada'
  if (state.subjects[id] === 'reprobada') return 'reprobada'
  if (support.prereqGroups === null || support.prereqGroups.length === 0) return 'disponible'
  if (support.prereqGroups.every((group) => prerequisiteGroupSatisfied(state, group))) return 'disponible'
  return 'bloqueada'
}

export function statusInfo(status: CourseStatus) {
  const map = {
    aprobada: { label: 'Aprobada', icon: '✓', className: 'approved' },
    reprobada: { label: 'Reprobada', icon: '×', className: 'failed' },
    pendiente: { label: 'Pendiente', icon: '◷', className: 'pending' },
    disponible: { label: 'Disponible', icon: '↗', className: 'available' },
    parcial: { label: 'Parcial', icon: '◒', className: 'partial' },
    bloqueada: { label: 'Bloqueada', icon: '—', className: 'blocked' },
  } as const
  return map[status]
}
