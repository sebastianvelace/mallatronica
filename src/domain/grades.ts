import { subjects } from '../data/curriculum'

export function readGrades(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, grade]) => typeof grade === 'number' && Number.isFinite(grade) && grade >= 0 && grade <= 5))
}

/** Single recorded grade per regular course, not a full attempt history. */
export function recordedAverage(notes: Record<string, number>) {
  let weighted = 0
  let credits = 0
  let courses = 0
  for (const subject of subjects) {
    const grade = notes[subject.id]
    if (typeof grade !== 'number' || !Number.isFinite(grade) || grade < 0 || grade > 5) continue
    weighted += grade * subject.credits
    credits += subject.credits
    courses++
  }
  return { value: credits ? weighted / credits : null, credits, courses }
}
