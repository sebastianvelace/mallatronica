import { courseCodeKey, subjects, type Subject } from '../data/curriculum'
import { referenceSemesterForCode } from '../data/reference-layout'
import { isApproved, isFreeChoiceApproved, missingRequirements, type AcademicRecord } from './progress'

/** Courses that list the given course in any prerequisite condition (an OR alternative included). */
const directDependents = new Map<string, Subject[]>(subjects.map((subject) => [
  subject.id,
  subjects.filter((candidate) => candidate.prerequisiteCodes.some((code) => courseCodeKey(code) === courseCodeKey(subject.code))),
]))

/** Not approved yet and every recorded requirement met; a failed course can be retaken. */
export function canTake(record: AcademicRecord, subject: Subject) {
  return !isApproved(record, subject) && missingRequirements(record, subject).length === 0
}

const descendantCache = new Map<string, Set<string>>()

/** Every course reachable through prerequisite links: a measure of how many paths a course opens. */
export function descendantsOf(subject: Subject) {
  const cached = descendantCache.get(subject.id)
  if (cached) return cached
  const seen = new Set<string>()
  const queue = [...(directDependents.get(subject.id) ?? [])]
  while (queue.length) {
    const next = queue.shift()!
    if (seen.has(next.id)) continue
    seen.add(next.id)
    queue.push(...(directDependents.get(next.id) ?? []))
  }
  descendantCache.set(subject.id, seen)
  return seen
}

export type PlanSuggestion = { subject: Subject; opens: number; semester: number | null }

/** Available courses not yet planned, ranked by the paths they open, then by suggested semester. */
export function planSuggestions(record: AcademicRecord, plan: readonly string[]): PlanSuggestion[] {
  const planned = new Set(plan)
  return subjects
    .filter((subject) => !planned.has(subject.id) && canTake(record, subject))
    .map((subject) => ({ subject, opens: descendantsOf(subject).size, semester: referenceSemesterForCode(subject.code) }))
    .sort((a, b) => b.opens - a.opens
      || (a.semester ?? 99) - (b.semester ?? 99)
      || a.subject.name.localeCompare(b.subject.name))
}

/** A copy of the record where every planned course is approved; the original is untouched. */
export function simulatePlan(record: AcademicRecord, plan: readonly string[]): AcademicRecord {
  const next: AcademicRecord = {
    ...record,
    subjects: { ...record.subjects },
    notes: { ...record.notes },
    freeChoiceStatus: { ...record.freeChoiceStatus },
    freeChoiceNotes: { ...record.freeChoiceNotes },
  }
  for (const id of plan) {
    if (subjects.some((subject) => subject.id === id)) {
      if (isApproved(record, { id })) continue
      delete next.notes[id]
      next.subjects[id] = 'aprobada'
    } else if (record.freeChoice.some((course) => course.id === id)) {
      delete next.freeChoiceNotes[id]
      next.freeChoiceStatus[id] = 'aprobada'
    }
  }
  return next
}

/** Courses that become available only if the whole plan is approved. */
export function unlockedByPlan(record: AcademicRecord, plan: readonly string[]) {
  const after = simulatePlan(record, plan)
  const planned = new Set(plan)
  return subjects.filter((subject) => !planned.has(subject.id)
    && !isApproved(record, subject)
    && !canTake(record, subject)
    && canTake(after, subject))
}

export type PlanItem = {
  id: string
  name: string
  code: string
  credits: number
  kind: 'plan' | 'free'
  state: 'ready' | 'approved' | 'blocked'
  sinProgramar: boolean
}

/** Resolves planned ids against the plan and the local free-choice catalogue. */
export function planItems(record: AcademicRecord, plan: readonly string[]): PlanItem[] {
  return plan.flatMap((id): PlanItem[] => {
    const subject = subjects.find((item) => item.id === id)
    if (subject) {
      return [{
        id, name: subject.name, code: subject.code, credits: subject.credits, kind: 'plan', sinProgramar: subject.sinProgramar,
        state: isApproved(record, subject) ? 'approved' : canTake(record, subject) ? 'ready' : 'blocked',
      }]
    }
    const course = record.freeChoice.find((item) => item.id === id)
    return course ? [{
      id, name: course.name, code: course.code, credits: course.credits, kind: 'free', sinProgramar: false,
      state: isFreeChoiceApproved(record, course) ? 'approved' : 'ready',
    }] : []
  })
}

/** Credits of planned courses that still have to be taken. */
export function plannedCredits(items: readonly PlanItem[]) {
  return items.reduce((sum, item) => sum + (item.state === 'approved' ? 0 : item.credits), 0)
}
