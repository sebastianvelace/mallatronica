import { subjects, supportSubjects } from '../data/curriculum'

type GradeCourse = { id: string; credits: number }

export function readGrades(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter(([, grade]) => typeof grade === 'number' && Number.isFinite(grade) && grade >= 0 && grade <= 5)
    .map(([id, grade]) => [id, Math.round(((grade as number) + Number.EPSILON) * 10) / 10]))
}

/** Single numeric grade per course, including math/literacy levelation but not AP/RE language requirements. */
export function recordedAverage(notes: Record<string, number>, freeChoiceCourses: GradeCourse[] = [], freeChoiceNotes: Record<string, number> = {}) {
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
  for (const subject of supportSubjects.filter(course => course.kind === 'nivelacion')) {
    const grade = notes[subject.id]
    if (typeof grade !== 'number' || !Number.isFinite(grade) || grade < 0 || grade > 5) continue
    weighted += grade * subject.credits
    credits += subject.credits
    courses++
  }
  for (const course of freeChoiceCourses) {
    const grade = freeChoiceNotes[course.id]
    if (typeof grade !== 'number' || !Number.isFinite(grade) || grade < 0 || grade > 5) continue
    weighted += grade * course.credits
    credits += course.credits
    courses++
  }
  return { value: credits ? weighted / credits : null, credits, courses }
}
