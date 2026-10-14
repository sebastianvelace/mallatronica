import { subjects, courseCodeKey } from '../data/curriculum'
import { referenceSemesters, type ReferenceSlot } from '../data/reference-layout'

export type FreeChoice = { id: string; code: string; name: string; credits: number; category: string }
export type ElectiveAssignments = Record<string, string>

export function referenceSlot(key: string): ReferenceSlot | undefined {
  if (!/^(?:[1-9]|10):[1-5]$/.test(key)) return undefined
  const [semester, row] = key.split(':').map(Number)
  const cell = referenceSemesters[semester - 1]?.[row - 1]
  return cell && typeof cell !== 'string' ? cell : undefined
}

export function electiveCandidates(slot: ReferenceSlot, freeChoices: FreeChoice[]) {
  if (slot.kind === 'free') return freeChoices.filter((course) => !subjects.some((subject) => courseCodeKey(subject.code) === courseCodeKey(course.code)))
  return subjects.filter((subject) => subject.tipologia.includes('OPTATIVA') && subject.track === (slot.kind === 'foundation' ? 'fundamentacion' : 'profesional'))
}

/** Assignments are planning choices, independent of grades and completion. */
export function readElectiveAssignments(value: unknown, freeChoices: FreeChoice[]): ElectiveAssignments {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: ElectiveAssignments = {}
  const usedCodes = new Set<string>()
  for (const [key, id] of Object.entries(value)) {
    const slot = referenceSlot(key)
    if (!slot || typeof id !== 'string') continue
    const candidate = electiveCandidates(slot, freeChoices).find((course) => course.id === id)
    if (!candidate || usedCodes.has(courseCodeKey(candidate.code))) continue
    result[key] = id
    usedCodes.add(courseCodeKey(candidate.code))
  }
  return result
}
