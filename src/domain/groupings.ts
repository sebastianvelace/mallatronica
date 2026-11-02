import data from '../../data/sia/agrupaciones.json'
import { courseCodeKey, subjects, type Subject } from '../data/curriculum'
import { isApproved, type AcademicRecord } from './progress'

export type Grouping = { id: string; nombre: string; componente: string; creditos_optativos: number }
export type GroupingSource = 'confirmada' | 'inferida' | 'ambigua'
export type CourseGrouping = { grouping: Grouping; source: GroupingSource; candidates: Grouping[]; reason: string }

type Membership = { agrupacion: string; estado: string; motivo: string; candidatas?: string[] }

export const groupings = data.agrupaciones as Grouping[]
const memberships = new Map(Object.entries(data.asignaturas as Record<string, Membership>).map(([code, value]) => [courseCodeKey(code), value]))
const byId = new Map(groupings.map(grouping => [grouping.id, grouping]))

/** Elective courses that can belong to a grouping: those of the grouping's component. */
export function groupingCandidatesFor(subject: Subject) {
  return groupings.filter(grouping => subject.tipologia.startsWith(grouping.componente))
}

/**
 * The grouping a student confirmed from their own SIA view wins; otherwise the
 * inferred one from data/sia/agrupaciones.json, which is never presented as official.
 */
export function groupingFor(subject: Subject, confirmed: Record<string, string> = {}): CourseGrouping | undefined {
  const candidates = groupingCandidatesFor(subject)
  const chosen = byId.get(confirmed[subject.id] ?? '')
  if (chosen && candidates.includes(chosen)) return { grouping: chosen, source: 'confirmada', candidates, reason: 'Confirmada por ti según tu SIA.' }
  const inferred = memberships.get(courseCodeKey(subject.code))
  const grouping = inferred && byId.get(inferred.agrupacion)
  if (!inferred || !grouping) return undefined
  return { grouping, source: inferred.candidatas?.length ? 'ambigua' : 'inferida', candidates, reason: inferred.motivo }
}

/** Keeps confirmations that point to an existing grouping of the course's component. */
export function readGroupingChoices(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([id, grouping]) => {
    const subject = subjects.find(item => item.id === id)
    return subject !== undefined && typeof grouping === 'string' && groupingCandidatesFor(subject).some(item => item.id === grouping)
  }))
}

export type GroupingRow = Grouping & { approved: number; remaining: number; courses: Subject[]; uncertain: boolean }

/** Approved elective credits per grouping, capped by each grouping's requirement. */
export function groupingBalance(record: AcademicRecord, confirmed: Record<string, string> = {}): GroupingRow[] {
  return groupings.map(grouping => {
    const courses = subjects.filter(subject => isApproved(record, subject) && groupingFor(subject, confirmed)?.grouping.id === grouping.id)
    const approved = courses.reduce((sum, subject) => sum + subject.credits, 0)
    return {
      ...grouping,
      approved,
      remaining: Math.max(0, grouping.creditos_optativos - approved),
      courses,
      uncertain: courses.some(subject => groupingFor(subject, confirmed)?.source !== 'confirmada'),
    }
  })
}
