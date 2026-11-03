import { AdfClient, BACK, SEARCH_URL } from './client.js'
import { parseDetail, resultLinks, visibleText, type SiaCourse } from './parse.js'

/** Each typology stays below the 25 rows the results table activates on the server. */
export const DEFAULT_TYPOLOGIES = ['FUND. OBLIGATORIA', 'FUND. OPTATIVA', 'DISCIPLINAR OBLIGATORIA', 'DISCIPLINAR OPTATIVA', 'TRABAJO DE GRADO', 'NIVELACI']

export type JobState = {
  version: 1
  startedAt: string
  updatedAt: string
  campus: string
  faculty: string
  plan: string
  planLabel: string
  typologies: string[]
  /** Typology being processed; equal to typologies.length when finished. */
  index: number
  courses: Record<string, SiaCourse>
  /** Detail attempts per course, so a course that never opens does not stall the job. */
  attempts: Record<string, number>
  requests: number
  steps: number
}

export type Snapshot = {
  fuente: { url: string; servicio: string; filtros: Record<string, unknown>; consultado: string; peticiones: number }
  asignaturas: SiaCourse[]
}

export function newJob(now = new Date(), { campus = '1101 SEDE BOGOT', faculty = '2055 FACULTAD DE INGENIER', plan = '2545', typologies = DEFAULT_TYPOLOGIES } = {}): JobState {
  const at = now.toISOString()
  return { version: 1, startedAt: at, updatedAt: at, campus, faculty, plan, planLabel: plan, typologies, index: 0, courses: {}, attempts: {}, requests: 0, steps: 0 }
}

const hasDetail = (course: SiaCourse | undefined) => !!course && (course.actividades !== undefined || course.detalle_no_disponible === true)
export const jobDone = (state: JobState) => state.index >= state.typologies.length

/**
 * Advances the job until the deadline and returns it; call again to continue.
 * The work is the same a person would do on the public search: pick the plan,
 * search each typology and open each course. Any session problem is recovered
 * by starting a fresh session on the next attempt.
 */
export async function runStep(state: JobState, { deadline, pauseMs = 1200, maxAttempts = 3 }: { deadline: number; pauseMs?: number; maxAttempts?: number }): Promise<JobState> {
  const next: JobState = structuredClone(state)
  next.steps++
  const client = new AdfClient(pauseMs)
  try {
    const { page, label } = await client.openPlan(next.campus, next.faculty, next.plan)
    next.planLabel = label
    let current = page
    while (!jobDone(next) && Date.now() < deadline) {
      const search = await client.search(current, next.typologies[next.index])
      current = search.page
      let links = search.links
      for (const row of search.rows) next.courses[row.codigo] = { ...next.courses[row.codigo], ...row }
      for (const row of search.rows) {
        if (hasDetail(next.courses[row.codigo])) continue
        if (Date.now() >= deadline) return finish(next, client)
        const link = links[row.codigo]
        const tries = (next.attempts[row.codigo] = (next.attempts[row.codigo] ?? 0) + 1)
        const detail = link ? await client.action(link) : ''
        if (link && visibleText(detail).includes(`(${row.codigo}`)) {
          Object.assign(next.courses[row.codigo], parseDetail(detail, row.codigo))
          current = await client.action(BACK)
          links = { ...links, ...resultLinks(current) }
          continue
        }
        if (tries >= maxAttempts) {
          next.courses[row.codigo].detalle_no_disponible = true
          continue
        }
        // The view lost its place: stop here; the next step opens a fresh session.
        return finish(next, client)
      }
      next.index++
    }
  } catch (error) {
    finish(next, client)
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { state: next })
  }
  return finish(next, client)
}

function finish(state: JobState, client: AdfClient) {
  state.requests += client.requests
  state.updatedAt = new Date().toISOString()
  return state
}

export function toSnapshot(state: JobState): Snapshot {
  return {
    fuente: {
      url: SEARCH_URL,
      servicio: 'Buscador de cursos (público, sin autenticación)',
      filtros: { nivel: 'Pregrado', sede: state.campus, facultad: state.faculty, plan: state.planLabel, tipologias: state.typologies },
      consultado: state.updatedAt,
      peticiones: state.requests,
    },
    asignaturas: Object.values(state.courses).sort((a, b) => a.codigo.localeCompare(b.codigo)),
  }
}

/** Problems that make a snapshot unfit to publish; empty when it is fine. */
export function validateSnapshot(snapshot: Snapshot, { minCourses = 50, minDetailRatio = 0.9 } = {}) {
  const problems: string[] = []
  const courses = snapshot.asignaturas
  if (courses.length < minCourses) problems.push(`Solo ${courses.length} asignaturas (mínimo ${minCourses}).`)
  const detailed = courses.filter(course => course.actividades !== undefined && !course.detalle_no_disponible).length
  if (courses.length && detailed / courses.length < minDetailRatio) problems.push(`Solo ${detailed} de ${courses.length} asignaturas con detalle.`)
  if (courses.some(course => course.creditos === null)) problems.push('Hay asignaturas sin créditos.')
  for (const course of courses) {
    for (const activity of course.actividades ?? []) {
      for (const group of activity.grupos) {
        if (!Number.isInteger(group.cupos_disponibles) || group.cupos_disponibles < 0) problems.push(`${course.codigo}: cupos inválidos.`)
        if (group.sesiones.some(session => !/^\d{2}:\d{2}$/.test(session.inicio) || !/^\d{2}:\d{2}$/.test(session.fin) || session.inicio >= session.fin)) problems.push(`${course.codigo}: sesión inválida.`)
      }
    }
  }
  return [...new Set(problems)]
}

type PlanEntry = { codigo: string; nombre: string; creditos: number | null; tipologia: string; agrupacion: unknown; prerrequisitos: unknown; semestre: unknown; sin_programar_2026_2: boolean }

/**
 * The plan file used by the app (data/sia/plan2545.json), rebuilt from a snapshot.
 * When a detail could not be read, the previous prerequisites are kept instead of
 * being replaced by "unknown".
 */
export function planEntries(snapshot: Snapshot, previous: PlanEntry[]): PlanEntry[] {
  const before = new Map(previous.map(course => [course.codigo, course]))
  return snapshot.asignaturas.map(course => {
    const old = before.get(course.codigo)
    const read = course.actividades !== undefined && !course.detalle_no_disponible
    return {
      codigo: course.codigo,
      nombre: course.nombre,
      creditos: course.creditos ?? old?.creditos ?? null,
      tipologia: course.tipologia,
      agrupacion: old?.agrupacion ?? null,
      prerrequisitos: read ? course.prerrequisitos ?? [] : old?.prerrequisitos ?? null,
      semestre: old?.semestre ?? null,
      // Historic key name kept for compatibility; it reflects the snapshot's term.
      sin_programar_2026_2: course.sin_programar,
    }
  }).sort((a, b) => {
    // Code-point order, as the previous Python generator wrote it, to keep diffs small.
    const x = a.nombre.toLowerCase()
    const y = b.nombre.toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
  })
}
