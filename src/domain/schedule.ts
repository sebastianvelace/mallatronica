import { scheduleDays, type ScheduleSlot } from './state'

export const DAY_START = 7 * 60
export const DAY_END = 21 * 60
export const SLOT_COLORS = 6

export type SlotProblem = 'incomplete' | 'order' | 'range' | 'conflict'

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** The slot that overlaps the candidate on the same day; the candidate's own id is ignored, so edits do not clash with themselves. */
export function findConflict(slots: readonly ScheduleSlot[], candidate: ScheduleSlot) {
  const start = timeToMinutes(candidate.start)
  const end = timeToMinutes(candidate.end)
  return slots.find((slot) => slot.id !== candidate.id
    && slot.day === candidate.day
    && start < timeToMinutes(slot.end)
    && end > timeToMinutes(slot.start))
}

export function validateSlot(slots: readonly ScheduleSlot[], candidate: ScheduleSlot): SlotProblem | null {
  if (!candidate.subjectId || !scheduleDays.includes(candidate.day) || !isTime(candidate.start) || !isTime(candidate.end)) return 'incomplete'
  if (timeToMinutes(candidate.end) <= timeToMinutes(candidate.start)) return 'order'
  if (timeToMinutes(candidate.start) < DAY_START || timeToMinutes(candidate.end) > DAY_END) return 'range'
  return findConflict(slots, candidate) ? 'conflict' : null
}

/** Inserts a new slot or replaces the one with the same id. */
export function upsertSlot(slots: readonly ScheduleSlot[], slot: ScheduleSlot) {
  return slots.some((item) => item.id === slot.id)
    ? slots.map((item) => item.id === slot.id ? slot : item)
    : [...slots, slot]
}

/** A stable color per course, so every block of the same course matches. */
export function slotColor(subjectId: string) {
  let hash = 0
  for (const character of subjectId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % SLOT_COLORS
}

export function scheduleAsText(slots: readonly ScheduleSlot[], nameFor: (id: string) => string | undefined) {
  return scheduleDays.map((day) => {
    const daySlots = slots.filter((slot) => slot.day === day).sort((a, b) => a.start.localeCompare(b.start))
    if (!daySlots.length) return `${day}: sin bloques`
    return `${day}:\n${daySlots.map((slot) => {
      const details = [slot.group && `grupo ${slot.group}`, slot.room].filter(Boolean).join(' · ')
      return `  ${slot.start}-${slot.end} · ${nameFor(slot.subjectId) ?? 'Materia'}${details ? ` · ${details}` : ''}`
    }).join('\n')}`
  }).join('\n')
}
