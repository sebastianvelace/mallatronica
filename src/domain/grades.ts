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

export type Attempts = Record<string, number[]>

const gradedCourseCredits = new Map<string, number>([
  ...subjects.map((subject): [string, number] => [subject.id, subject.credits]),
  ...supportSubjects.filter(course => course.kind === 'nivelacion').map((course): [string, number] => [course.id, course.credits]),
])

function creditsFor(id: string, freeChoiceCourses: GradeCourse[]) {
  return gradedCourseCredits.get(id) ?? freeChoiceCourses.find(course => course.id === id)?.credits
}

/**
 * Earlier failing grades of repeated courses; the latest grade stays in the notes.
 * Only courses with numeric grades qualify, and a passed attempt cannot precede a retake.
 */
export function readAttempts(value: unknown, freeChoiceCourses: GradeCourse[] = []): Attempts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Attempts = {}
  for (const [id, grades] of Object.entries(value)) {
    if (creditsFor(id, freeChoiceCourses) === undefined || !Array.isArray(grades)) continue
    const valid = readGrades(Object.fromEntries(grades.map((grade, index) => [index, grade])))
    const failing = Object.values(valid).filter(grade => grade < 3)
    if (failing.length) result[id] = failing
  }
  return result
}

/**
 * PAPA (Acuerdo 008 de 2008, Art. 42): every final grade of every attempt, weighted by credits.
 * The PA (Art. 41) is the recorded average, which keeps only the latest grade per course.
 */
export function cumulativeAverage(notes: Record<string, number>, attempts: Attempts, freeChoiceCourses: GradeCourse[] = [], freeChoiceNotes: Record<string, number> = {}) {
  const latest = recordedAverage(notes, freeChoiceCourses, freeChoiceNotes)
  let weighted = (latest.value ?? 0) * latest.credits
  let credits = latest.credits
  let repeated = 0
  for (const [id, grades] of Object.entries(attempts)) {
    const courseCredits = creditsFor(id, freeChoiceCourses)
    if (courseCredits === undefined) continue
    for (const grade of grades) {
      weighted += grade * courseCredits
      credits += courseCredits
      repeated++
    }
  }
  return { value: credits ? weighted / credits : null, credits, attempts: latest.courses + repeated, repeated }
}
