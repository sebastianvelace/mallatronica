import snapshot from '../../data/sia/snapshots/latest.json'
import { courseCodeKey } from './curriculum'

/** Snapshot of the public SIA course search, produced by scripts/sia/snapshot.py. */
type SiaSession = { dia: string; inicio: string; fin: string; lugar: string }
type SiaGroup = {
  grupo: string
  profesor: string | null
  fecha_inicio: string
  fecha_fin: string
  sesiones: SiaSession[]
  duracion: string
  jornada: string
  cupos_disponibles: number
}
type SiaCourse = {
  codigo: string
  nombre: string
  creditos: number | null
  tipologia: string
  sin_programar: boolean
  actividades?: { actividad: string; grupos: SiaGroup[] }[]
  detalle_no_disponible?: boolean
}

export type OfferSession = { day: string; start: string; end: string; place: string }
export type OfferGroup = {
  activity: string
  group: string
  teacher: string | null
  sessions: OfferSession[]
  seats: number
  startDate: string
  endDate: string
}
export type CourseOffer = {
  /** True when the SIA lists the course as "ASIGNATURA SIN PROGRAMAR". */
  unscheduled: boolean
  /** False when the course detail could not be read, so groups are unknown. */
  detailed: boolean
  groups: OfferGroup[]
  activities: string[]
  seats: number
}

const data = snapshot as { fuente: { consultado: string; url: string }; asignaturas: SiaCourse[] }

const dayNames: Record<string, string> = { LUNES: 'Lunes', MARTES: 'Martes', 'MIÉRCOLES': 'Miércoles', JUEVES: 'Jueves', VIERNES: 'Viernes', 'SÁBADO': 'Sábado', DOMINGO: 'Domingo' }

function toOffer(course: SiaCourse): CourseOffer {
  const groups = (course.actividades ?? []).flatMap((activity) => activity.grupos.map((group) => ({
    activity: activity.actividad,
    group: group.grupo,
    teacher: group.profesor,
    sessions: group.sesiones.map((session) => ({ day: dayNames[session.dia] ?? session.dia, start: session.inicio, end: session.fin, place: session.lugar })),
    seats: group.cupos_disponibles,
    startDate: group.fecha_inicio,
    endDate: group.fecha_fin,
  })))
  return {
    unscheduled: course.sin_programar,
    detailed: course.actividades !== undefined && !course.detalle_no_disponible,
    groups,
    activities: [...new Set(groups.map((group) => group.activity))],
    seats: groups.reduce((sum, group) => sum + group.seats, 0),
  }
}

const offers = new Map(data.asignaturas.map((course) => [courseCodeKey(course.codigo), toOffer(course)]))

export function offerFor(code: string): CourseOffer | undefined {
  return offers.get(courseCodeKey(code))
}

/** ISO timestamp of the SIA consultation. */
export const offerConsultedAt = data.fuente.consultado

/** Term inferred from the groups' start dates, e.g. "2026-2"; null when no group was read. */
export const offerTerm = (() => {
  const date = data.asignaturas.flatMap((course) => course.actividades ?? []).flatMap((activity) => activity.grupos)[0]?.fecha_inicio
  const match = date?.match(/^\d{2}\/(\d{2})\/(\d{4})$/)
  return match ? `${match[2]}-${Number(match[1]) >= 7 ? 2 : 1}` : null
})()

/** One-line summary for compact UI. */
export function offerSummary(offer: CourseOffer | undefined) {
  if (!offer) return 'Sin datos del SIA'
  if (offer.unscheduled) return 'Sin programar en el SIA'
  if (!offer.detailed) return 'Programada · grupos no leídos'
  const groups = offer.groups.length
  return `${groups} grupo${groups === 1 ? '' : 's'} · ${offer.seats} cupo${offer.seats === 1 ? '' : 's'}`
}
