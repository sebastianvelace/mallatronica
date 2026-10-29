import { courseCodeKey, disciplinaryIds, subjects, type PrerequisiteGroup, type PrerequisiteRef, type Subject } from '../data/curriculum'
import type { CatalogCourse } from './catalog'
import { creditBalance } from './credit-balance'

export type Status = 'aprobada' | 'reprobada' | 'pendiente'
export type RequirementStatus = 'sin-definir' | 'pendiente' | 'cumplida' | 'exento' | 'no-aplica'
export type CourseStatus = Status | 'disponible' | 'parcial' | 'bloqueada'

/** The academic fields needed to evaluate eligibility; the app state satisfies it structurally. */
export type AcademicRecord = {
  subjects: Record<string, Status>
  notes: Record<string, number>
  mathBasics: RequirementStatus
  freeChoice: CatalogCourse[]
  freeChoiceStatus: Record<string, Status>
  freeChoiceNotes: Record<string, number>
}

const subjectsByCode = new Map(subjects.map(subject => [courseCodeKey(subject.code), subject]))

export function subjectForCode(code: string) {
  return subjectsByCode.get(courseCodeKey(code))
}

/** A saved grade takes precedence over a manual mark. */
export function isApproved(record: AcademicRecord, subject: { id: string }) {
  return record.notes[subject.id] !== undefined
    ? record.notes[subject.id] >= 3
    : record.subjects[subject.id] === 'aprobada'
}

export function isFreeChoiceApproved(record: AcademicRecord, course: CatalogCourse) {
  return record.freeChoiceNotes[course.id] !== undefined
    ? record.freeChoiceNotes[course.id] >= 3
    : record.freeChoiceStatus[course.id] === 'aprobada'
}

export function approvedFreeChoiceCredits(record: AcademicRecord) {
  return record.freeChoice.reduce((sum, course) => sum + (isFreeChoiceApproved(record, course) ? course.credits : 0), 0)
}

export function recordBalance(record: AcademicRecord) {
  return creditBalance(subjects.filter(subject => isApproved(record, subject)).map(subject => subject.id), approvedFreeChoiceCredits(record))
}

export function approvedCredits(record: AcademicRecord) {
  return recordBalance(record).allocated
}

export function approvedDisciplinaryCredits(record: AcademicRecord) {
  return subjects.reduce((sum, subject) => sum + (disciplinaryIds.has(subject.id) && isApproved(record, subject) ? subject.credits : 0), 0)
}

/** Credits taken (graded or marked approved), regardless of the result. */
export function recordedRegularCredits(record: AcademicRecord) {
  return subjects.reduce((sum, subject) => sum + ((record.notes[subject.id] !== undefined || record.subjects[subject.id] === 'aprobada') ? subject.credits : 0), 0)
}

export function prerequisiteSatisfied(record: AcademicRecord, reference: PrerequisiteRef) {
  const subject = subjectForCode(reference.code)
  return subject ? isApproved(record, subject) : false
}

export function prerequisiteGroupSatisfied(record: AcademicRecord, group: PrerequisiteGroup) {
  const statuses = group.items.map(item => prerequisiteSatisfied(record, item))
  return group.mode === 'all' ? statuses.every(Boolean) : statuses.some(Boolean)
}

export function prerequisiteGroupLabel(group: PrerequisiteGroup) {
  const names = group.items.map(item => `${item.name} (${item.code})`).join(group.mode === 'all' ? ' y ' : ' o ')
  return `Condición ${group.condition}: ${names}`
}

/** Mathematics Basics blocks Cálculo diferencial until it is approved, exempted or configured as not required. */
export function mathBasicsBlocks(record: AcademicRecord, subject: Subject) {
  if (subject.id !== 'calculo-diferencial') return false
  if (record.mathBasics !== 'pendiente' && record.mathBasics !== 'sin-definir') return false
  const grade = record.notes['matematicas-basicas']
  return grade === undefined || grade < 3
}

export function missingRequirements(record: AcademicRecord, subject: Subject) {
  const missing = subject.prereqGroups === null
    ? ['Prerrequisitos no publicados por el SIA']
    : subject.prereqGroups.filter(group => !prerequisiteGroupSatisfied(record, group)).map(prerequisiteGroupLabel)

  if (mathBasicsBlocks(record, subject)) missing.unshift(record.mathBasics === 'sin-definir' ? 'Configurar situación de Matemáticas básicas' : 'Matemáticas básicas')

  for (const requirement of subject.globalPrereqs ?? []) {
    const current = requirement.kind === 'regularCredits'
      ? approvedCredits(record)
      : requirement.kind === 'recordedRegularCredits'
        ? recordedRegularCredits(record)
        : approvedDisciplinaryCredits(record)
    if (current < requirement.value) missing.push(`${requirement.label} (llevas ${current})`)
  }

  return missing
}

export function courseStatus(record: AcademicRecord, subject: Subject): CourseStatus {
  if (record.notes[subject.id] !== undefined) return record.notes[subject.id] >= 3 ? 'aprobada' : 'reprobada'
  if (record.subjects[subject.id]) return record.subjects[subject.id]
  const missing = missingRequirements(record, subject)
  if (missing.length === 0) return 'disponible'
  const total = (subject.prereqGroups?.length ?? 0) + (subject.globalPrereqs?.length ?? 0) + (mathBasicsBlocks(record, subject) ? 1 : 0)
  return total - missing.length > 0 ? 'parcial' : 'bloqueada'
}
