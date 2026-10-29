import { courseCodeKey, subjects, supportSubjects } from '../data/curriculum'
import type { CatalogCourse } from './catalog'
import { readElectiveAssignments, type ElectiveAssignments } from './electives'
import { readGrades } from './grades'
import type { RequirementStatus, Status } from './progress'

export type ScheduleDay = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado'
export type Theme = 'dark' | 'light'

export type ScheduleSlot = {
  id: string
  subjectId: string
  day: ScheduleDay
  start: string
  end: string
  group: string
  room: string
}

export type State = {
  schemaVersion: number
  subjects: Record<string, Status>
  notes: Record<string, number>
  theme: Theme
  mathBasics: RequirementStatus
  literacy: RequirementStatus
  english: RequirementStatus
  schedule: ScheduleSlot[]
  freeChoice: CatalogCourse[]
  freeChoiceStatus: Record<string, Status>
  freeChoiceNotes: Record<string, number>
  electiveAssignments: ElectiveAssignments
}

export const SCHEMA_VERSION = 7
export const scheduleDays: ScheduleDay[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const planIds = new Set([...subjects, ...supportSubjects].map(subject => subject.id))

export function emptyState(theme: Theme = 'light'): State {
  return {
    schemaVersion: SCHEMA_VERSION,
    subjects: {},
    notes: {},
    theme,
    mathBasics: 'sin-definir',
    literacy: 'sin-definir',
    english: 'sin-definir',
    schedule: [],
    freeChoice: [],
    freeChoiceStatus: {},
    freeChoiceNotes: {},
    electiveAssignments: {},
  }
}

export function readRequirementStatus(value: unknown): RequirementStatus {
  return value === 'pendiente' || value === 'cumplida' || value === 'exento' || value === 'no-aplica' || value === 'sin-definir' ? value : 'sin-definir'
}

export function readStatuses(value: unknown): Record<string, Status> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, status]) => status === 'aprobada' || status === 'reprobada' || status === 'pendiente'))
}

function isScheduleSlot(value: unknown): value is ScheduleSlot {
  if (!value || typeof value !== 'object') return false
  const slot = value as Partial<ScheduleSlot>
  return typeof slot.id === 'string'
    && typeof slot.subjectId === 'string'
    && scheduleDays.includes(slot.day as ScheduleDay)
    && typeof slot.start === 'string'
    && typeof slot.end === 'string'
    && typeof slot.group === 'string'
    && typeof slot.room === 'string'
}

/** Free-choice ids share lookups with plan courses (schedule, slots), so they must never reuse a plan id. */
function isChoiceCourse(value: unknown): value is CatalogCourse {
  if (!value || typeof value !== 'object') return false
  const course = value as Partial<CatalogCourse>
  return typeof course.id === 'string'
    && !planIds.has(course.id)
    && typeof course.code === 'string'
    && typeof course.name === 'string'
    && typeof course.credits === 'number'
    && course.credits > 0
    && typeof course.category === 'string'
    && (course.source === 'manual' || course.source === 'imported' || course.source === 'sia-public')
}

export function readStoredChoiceCourses(value: unknown) {
  if (!Array.isArray(value)) return []
  const seenIds = new Set<string>()
  const seenCodes = new Set<string>()
  return value.filter(isChoiceCourse).filter(course => {
    const code = courseCodeKey(course.code)
    if (!code || seenIds.has(course.id) || seenCodes.has(code)) return false
    seenIds.add(course.id)
    seenCodes.add(code)
    return true
  })
}

export function pruneFreeChoiceProgress(state: State) {
  const ids = new Set(state.freeChoice.map(course => course.id))
  state.freeChoiceStatus = Object.fromEntries(Object.entries(state.freeChoiceStatus).filter(([id]) => ids.has(id)))
  state.freeChoiceNotes = Object.fromEntries(Object.entries(state.freeChoiceNotes).filter(([id]) => ids.has(id)))
  return state
}

/** Validates stored or imported progress. Unknown or malformed fields fall back to safe defaults. */
export function parseState(value: unknown, fallbackTheme: Theme = 'light'): State {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState(fallbackTheme)
  const raw = value as Partial<State>
  const freeChoice = readStoredChoiceCourses(raw.freeChoice)
  const themeIsStored = [5, 6, 7].includes(raw.schemaVersion ?? 0) && (raw.theme === 'dark' || raw.theme === 'light')
  const state: State = {
    schemaVersion: SCHEMA_VERSION,
    subjects: readStatuses(raw.subjects),
    notes: readGrades(raw.notes),
    theme: themeIsStored ? raw.theme as Theme : fallbackTheme,
    mathBasics: readRequirementStatus(raw.mathBasics),
    literacy: readRequirementStatus(raw.literacy),
    english: readRequirementStatus(raw.english),
    schedule: Array.isArray(raw.schedule) ? raw.schedule.filter(isScheduleSlot) : [],
    freeChoice,
    freeChoiceStatus: readStatuses(raw.freeChoiceStatus),
    freeChoiceNotes: readGrades(raw.freeChoiceNotes),
    electiveAssignments: readElectiveAssignments(raw.electiveAssignments, freeChoice),
  }
  // A grade decides the result; a stale manual mark would contradict it.
  for (const id of Object.keys(state.notes)) delete state.subjects[id]
  for (const id of Object.keys(state.freeChoiceNotes)) delete state.freeChoiceStatus[id]
  return pruneFreeChoiceProgress(state)
}

/** An import must at least look like an exported progress file. */
export function isProgressFile(value: unknown) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && !!(value as Partial<State>).subjects && typeof (value as Partial<State>).subjects === 'object'
}
