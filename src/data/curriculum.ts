import siaPlan from '../../data/sia/plan2545.json'

export type Track = 'fundamentacion' | 'profesional' | 'electiva'
export type PrerequisiteType = 'M' | 'O' | 'E' | 'A' | string

export type PrerequisiteRef = {
  code: string
  name: string
  type: PrerequisiteType
  condition: number
  corequisite: boolean
}

export type PrerequisiteGroup = {
  condition: number
  mode: 'all' | 'any'
  type: PrerequisiteType
  items: PrerequisiteRef[]
}

export type GlobalRequirement = {
  kind: 'regularCredits' | 'disciplinaryCredits' | 'recordedRegularCredits'
  value: number
  label: string
}

export type Subject = {
  id: string
  code: string
  name: string
  credits: number
  semester: number | null
  track: Track
  category: string
  tipologia: string
  prereqGroups: PrerequisiteGroup[] | null
  prerequisiteCodes: string[]
  globalPrereqs?: GlobalRequirement[]
  tag?: string
  sinProgramar: boolean
}

export type SupportSubject = {
  id: string
  code: string
  name: string
  credits: number
  kind: 'nivelacion' | 'idioma'
  prereqGroups: PrerequisiteGroup[] | null
  sinProgramar: boolean
}

type SiaRawPrerequisite = {
  codigo: string
  nombre: string
  tipo: PrerequisiteType
  condicion: number
  todas: boolean
  correquisito: boolean
}

type SiaRawCourse = {
  codigo: string
  nombre: string
  creditos: number
  tipologia: string
  agrupacion: string | null
  prerrequisitos: SiaRawPrerequisite[] | null
  semestre: number | null
  sin_programar_2026_2: boolean
}

const rawPlan = siaPlan as SiaRawCourse[]

export const curriculumMeta = {
  plan: '2545',
  program: 'Ingeniería Electrónica',
  campus: 'Bogotá',
  sourceLabel: 'Catálogo público SIA · consulta 2026-10-13',
  regularCredits: 172,
  disciplinaryCredits: 78,
} as const

export function courseCodeKey(code: string) {
  return code.toLocaleUpperCase().replace(/[^A-Z0-9]/g, '')
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const legacyIdsByCode: Record<string, string> = {
  '1000003-B': 'algebra-lineal',
  '1000004-B': 'calculo-diferencial',
  '1000005-B': 'calculo-integral',
  '1000006-B': 'calculo-varias',
  '1000007-B': 'ecuaciones',
  '1000017-B': 'fund-electricidad',
  '1000019-B': 'fund-mecanica',
  '1000020-B': 'ondas-optica',
  '1000040-B': 'materiales',
  '2015159': 'variable-compleja',
  '2015316': 'trabajo-grado',
  '2015734': 'programacion',
  '2016375': 'programacion-objetos',
  '2016487': 'campos',
  '2016489': 'circuitos-1',
  '2016490': 'circuitos-2',
  '2016492': 'comunicaciones',
  '2016493': 'control',
  '2016495': 'electronica-analoga-1',
  '2016496': 'electronica-analoga-2',
  '2016497': 'potencia',
  '2016498': 'electronica-digital-1',
  '2016499': 'electronica-digital-2',
  '2016500': 'semiconductores',
  '2016501': 'instrumentacion',
  '2016502': 'intro-electronica',
  '2016503': 'lineas-antenas',
  '2016506': 'senales-1',
  '2016507': 'senales-2',
  '2016509': 'taller-electronica',
  '2016510': 'taller-proyectos',
  '2016512': 'verificacion-sistemas-digitales',
  '2024045': 'taller-proyectos',
  '1000001-B': 'matematicas-basicas',
  '1000002-B': 'lecto-escritura',
  '1000044-B': 'ingles-1',
  '1000045-B': 'ingles-2',
  '1000046-B': 'ingles-3',
  '1000047-B': 'ingles-4',
}

const displayNamesByCode: Record<string, string> = {
  '1000002-B': 'Lectoescritura',
  '1000040-B': 'Introducción a la ciencia de materiales',
  '2016509': 'Taller de electrónica',
}

function trackFor(tipologia: string): Track {
  if (tipologia.startsWith('DISCIPLINAR') || tipologia.startsWith('TRABAJO')) return 'profesional'
  if (tipologia.startsWith('NIVELACIÓN')) return 'electiva'
  return 'fundamentacion'
}

function prerequisitesFor(raw: SiaRawPrerequisite[] | null): PrerequisiteGroup[] | null {
  if (raw === null) return null
  const grouped = new Map<number, SiaRawPrerequisite[]>()
  for (const item of raw) grouped.set(item.condicion, [...(grouped.get(item.condicion) ?? []), item])
  return Array.from(grouped.entries()).sort(([a], [b]) => a - b).map(([condition, items]) => ({
    condition,
    mode: items.every((item) => item.todas) ? 'all' : 'any',
    type: items[0]?.tipo ?? 'M',
    items: items.map((item) => ({
      code: item.codigo,
      name: item.nombre,
      type: item.tipo,
      condition: item.condicion,
      corequisite: item.correquisito,
    })),
  }))
}

function isLanguageCourse(name: string) {
  return /ingl[eé]s|idioma extranjero|suficiencia por acogimiento/i.test(name)
}

function subjectFromRaw(raw: SiaRawCourse): Subject {
  const prereqGroups = prerequisitesFor(raw.prerrequisitos)
  const tag = raw.tipologia.includes('OPTATIVA') ? 'Optativa' : raw.tipologia.startsWith('TRABAJO') ? 'Grado' : undefined
  const globalPrereqs: GlobalRequirement[] = []
  if (raw.codigo === '2028816') globalPrereqs.push({
    kind: 'recordedRegularCredits',
    value: 138,
    label: '80% del plan cursado (conceptos previos publicados; confirmar en SIA)',
  })
  if (raw.codigo === '2024045') globalPrereqs.push({
    kind: 'regularCredits',
    value: 121,
    label: '70% del plan aprobado (malla de referencia; confirmar en SIA)',
  })
  if (raw.codigo === '2015316' || raw.codigo === '2015317') globalPrereqs.push({
    kind: 'disciplinaryCredits',
    value: 63,
    label: '80% del componente disciplinar aprobado (PEP 2017; vigencia por confirmar)',
  })
  return {
    id: legacyIdsByCode[raw.codigo] ?? `sia-${slug(raw.codigo)}-${slug(raw.nombre)}`,
    code: raw.codigo,
    name: displayNamesByCode[raw.codigo] ?? raw.nombre,
    credits: raw.creditos,
    semester: raw.semestre,
    track: trackFor(raw.tipologia),
    category: raw.tipologia,
    tipologia: raw.tipologia,
    prereqGroups,
    prerequisiteCodes: prereqGroups?.flatMap((group) => group.items.map((item) => item.code)) ?? [],
    globalPrereqs: globalPrereqs.length ? globalPrereqs : undefined,
    tag,
    sinProgramar: raw.sin_programar_2026_2,
  }
}

const allCourses = rawPlan.map(subjectFromRaw)

export const subjects = allCourses.filter((subject) => !subject.tipologia.startsWith('NIVELACIÓN'))

export const supportSubjects: SupportSubject[] = allCourses
  .filter((subject) => subject.tipologia.startsWith('NIVELACIÓN'))
  .map((subject) => ({
    id: subject.id,
    code: subject.code,
    name: subject.name,
    credits: subject.credits,
    kind: isLanguageCourse(subject.name) ? 'idioma' : 'nivelacion',
    prereqGroups: subject.prereqGroups,
    sinProgramar: subject.sinProgramar,
  }))

export const disciplinaryIds = new Set(subjects.filter((subject) => subject.tipologia.startsWith('DISCIPLINAR')).map((subject) => subject.id))

export const rawCourseCount = rawPlan.length
export const unplacedCourseCount = subjects.filter((subject) => subject.semester === null).length
