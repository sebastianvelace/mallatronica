/** Pure helpers for the landing, kept apart from the DOM so they can be tested. */

export const STATE_KEY = 'mallatronica-state-v2'

/** True when this browser already holds an onboarded or marked-up progress record. */
export function hasSavedProgress(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    const raw = storage?.getItem(STATE_KEY)
    if (!raw) return false
    const state = JSON.parse(raw) as { onboarded?: boolean; subjects?: Record<string, unknown> }
    return Boolean(state?.onboarded || (state?.subjects && Object.keys(state.subjects).length))
  } catch {
    return false
  }
}

export type SiaStatus = {
  finishedAt: string | null
  published: boolean
  job?: { courses?: number }
  offer?: { courses: number; groups: number }
}

const DAY = 86_400_000

/** "hoy, 6:17 a. m.", "ayer, 6:20 a. m." or "28 oct." in Bogotá time. */
export function formatUpdated(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const zone = 'America/Bogota'
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d)
  const time = new Intl.DateTimeFormat('es-CO', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(date)
  if (day(date) === day(now)) return `hoy, ${time}`
  if (day(date) === day(new Date(now.getTime() - DAY))) return `ayer, ${time}`
  return new Intl.DateTimeFormat('es-CO', { timeZone: zone, day: 'numeric', month: 'short' }).format(date)
}

/** What the hero badge and the data section show, or null when there is nothing trustworthy to show. */
export function describeStatus(status: SiaStatus | null, now = new Date()) {
  if (!status?.published || !status.finishedAt) return null
  const courses = status.offer?.courses ?? status.job?.courses
  const groups = status.offer?.groups
  const updated = formatUpdated(status.finishedAt, now)
  const parts = [`Oferta del SIA actualizada ${updated}`]
  if (courses) parts.push(`${courses} asignaturas`)
  if (groups) parts.push(`${groups} grupos`)
  return { badge: parts.join(' · '), updated: updated.charAt(0).toUpperCase() + updated.slice(1), courses, groups }
}
