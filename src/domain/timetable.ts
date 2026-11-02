import { DAY_END, DAY_START, timeToMinutes } from './schedule'
import { scheduleDays, type ScheduleDay } from './state'

export type TimetableSession = { day: string; start: string; end: string; place: string }
export type TimetableGroup = { activity: string; group: string; seats: number; teacher: string | null; sessions: TimetableSession[] }
export type TimetableCourse = { id: string; name: string; groups: TimetableGroup[] }
export type BusyBlock = { day: string; start: string; end: string }

export type TimetablePick = { courseId: string; courseName: string; group: TimetableGroup }
export type TimetableOption = {
  picks: TimetablePick[]
  /** Days with at least one class. */
  days: number
  /** Idle minutes between the first and last class of each day. */
  gapMinutes: number
  /** Latest end time across the week, in minutes. */
  latestEnd: number
}
export type TimetableResult = {
  options: TimetableOption[]
  /** Course activities with no usable group (no seats, or outside Monday–Saturday 07:00–21:00). */
  missing: { courseId: string; courseName: string; activity: string }[]
  /** True when the search stopped at its limit, so better options may exist. */
  truncated: boolean
}

type Interval = { day: string; start: number; end: number }

function intervals(sessions: { day: string; start: string; end: string }[]): Interval[] {
  return sessions.map(session => ({ day: session.day, start: timeToMinutes(session.start), end: timeToMinutes(session.end) }))
}

function overlaps(a: Interval[], b: Interval[]) {
  return a.some(x => b.some(y => x.day === y.day && x.start < y.end && x.end > y.start))
}

function fitsBoard(group: TimetableGroup) {
  return group.sessions.length > 0 && group.sessions.every(session => scheduleDays.includes(session.day as ScheduleDay)
    && timeToMinutes(session.start) >= DAY_START && timeToMinutes(session.end) <= DAY_END)
}

function score(picks: TimetablePick[]): TimetableOption {
  const byDay = new Map<string, Interval[]>()
  for (const pick of picks) for (const interval of intervals(pick.group.sessions)) byDay.set(interval.day, [...(byDay.get(interval.day) ?? []), interval])
  let gapMinutes = 0
  let latestEnd = 0
  for (const day of byDay.values()) {
    day.sort((a, b) => a.start - b.start)
    for (let i = 1; i < day.length; i++) gapMinutes += Math.max(0, day[i].start - day[i - 1].end)
    latestEnd = Math.max(latestEnd, ...day.map(interval => interval.end))
  }
  return { picks, days: byDay.size, gapMinutes, latestEnd }
}

/** Fewer days first, then fewer idle minutes, then finishing earlier. */
function compare(a: TimetableOption, b: TimetableOption) {
  return a.days - b.days || a.gapMinutes - b.gapMinutes || a.latestEnd - b.latestEnd
}

/**
 * Picks one group per activity of every course (e.g. one lecture and one lab
 * group) with no overlaps among them nor with the fixed blocks, and returns
 * the best combinations. The search is bounded so it stays instant.
 */
export function buildTimetables(courses: TimetableCourse[], fixed: BusyBlock[] = [], { requireSeats = true, limit = 5, maxNodes = 60_000 } = {}): TimetableResult {
  const fixedIntervals = intervals(fixed)
  const slots: { course: TimetableCourse; activity: string; groups: TimetableGroup[] }[] = []
  const missing: TimetableResult['missing'] = []
  for (const course of courses) {
    for (const activity of [...new Set(course.groups.map(group => group.activity))]) {
      const usable = course.groups.filter(group => group.activity === activity && fitsBoard(group) && (!requireSeats || group.seats > 0) && !overlaps(intervals(group.sessions), fixedIntervals))
      if (usable.length) slots.push({ course, activity, groups: usable })
      else missing.push({ courseId: course.id, courseName: course.name, activity })
    }
  }
  if (missing.length) return { options: [], missing, truncated: false }

  // Most constrained activities first: conflicts surface early and prune the tree.
  slots.sort((a, b) => a.groups.length - b.groups.length)
  const best: TimetableOption[] = []
  const chosen: TimetablePick[] = []
  const taken: Interval[] = []
  let nodes = 0
  let truncated = false

  function visit(index: number) {
    if (truncated) return
    if (index === slots.length) {
      best.push(score([...chosen]))
      best.sort(compare)
      if (best.length > limit) best.pop()
      return
    }
    for (const group of slots[index].groups) {
      if (++nodes > maxNodes) { truncated = true; return }
      const own = intervals(group.sessions)
      if (overlaps(own, taken)) continue
      chosen.push({ courseId: slots[index].course.id, courseName: slots[index].course.name, group })
      taken.push(...own)
      visit(index + 1)
      taken.splice(taken.length - own.length, own.length)
      chosen.pop()
    }
  }
  visit(0)
  return { options: best, missing, truncated }
}
