export type Track = 'fundamentacion' | 'profesional' | 'electiva'

export type GlobalRequirement = {
  kind: 'regularCredits' | 'disciplinaryCredits'
  value: number
  label: string
}

export type Subject = {
  id: string
  code: string
  name: string
  credits: number
  semester: number
  track: Track
  category: string
  prereqs: string[]
  globalPrereqs?: GlobalRequirement[]
  tag?: string
}

export type SupportSubject = {
  id: string
  code: string
  name: string
  credits: number
  kind: 'nivelacion' | 'idioma'
  prereqs: string[]
}

export const curriculumMeta = {
  plan: '2545',
  program: 'Ingeniería Electrónica',
  campus: 'Bogotá',
  sourceLabel: 'Malla oficial encontrada · 2023',
  regularCredits: 172,
  disciplinaryCredits: 78,
  projectThreshold: 121,
  thesisThreshold: 63,
} as const

export const semesterTotals = [17, 18, 18, 19, 17, 17, 16, 16, 16, 18]

export const subjects: Subject[] = [
  { id: 'calculo-diferencial', code: '1000004', name: 'Cálculo diferencial', credits: 4, semester: 1, track: 'fundamentacion', category: 'Matemáticas', prereqs: [] },
  { id: 'libre-socio-1', code: 'CLE', name: 'Libre elección · socio-humanística', credits: 3, semester: 1, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'intro-electronica', code: '2016502', name: 'Introducción a la ingeniería electrónica', credits: 5, semester: 1, track: 'profesional', category: 'Contexto profesional', prereqs: [] },
  { id: 'programacion', code: '2015734', name: 'Programación de computadores', credits: 3, semester: 1, track: 'fundamentacion', category: 'Informática', prereqs: [] },
  { id: 'taller-electronica', code: '2016509', name: 'Taller de electrónica', credits: 2, semester: 1, track: 'profesional', category: 'Contexto profesional', prereqs: [] },

  { id: 'calculo-integral', code: '1000005', name: 'Cálculo integral', credits: 4, semester: 2, track: 'fundamentacion', category: 'Matemáticas', prereqs: ['calculo-diferencial'] },
  { id: 'algebra-lineal', code: '1000003', name: 'Álgebra lineal', credits: 4, semester: 2, track: 'fundamentacion', category: 'Matemáticas', prereqs: ['calculo-diferencial'] },
  { id: 'fund-mecanica', code: '1000019', name: 'Fundamentos de mecánica', credits: 4, semester: 2, track: 'fundamentacion', category: 'Física', prereqs: ['calculo-diferencial'] },
  { id: 'programacion-objetos', code: '2016375', name: 'Programación orientada a objetos', credits: 3, semester: 2, track: 'fundamentacion', category: 'Informática', prereqs: ['programacion'] },
  { id: 'libre-socio-2', code: 'CLE', name: 'Libre elección · socio-humanística', credits: 3, semester: 2, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },

  { id: 'calculo-varias', code: '1000006', name: 'Cálculo en varias variables', credits: 4, semester: 3, track: 'fundamentacion', category: 'Matemáticas', prereqs: ['calculo-integral', 'algebra-lineal'] },
  { id: 'ecuaciones', code: '1000007', name: 'Ecuaciones diferenciales', credits: 4, semester: 3, track: 'fundamentacion', category: 'Matemáticas', prereqs: ['calculo-integral', 'algebra-lineal'] },
  { id: 'fund-electricidad', code: '1000017', name: 'Fundamentos de electricidad y magnetismo', credits: 4, semester: 3, track: 'fundamentacion', category: 'Física', prereqs: ['fund-mecanica'] },
  { id: 'materiales', code: '1000040', name: 'Introducción a la ciencia de materiales', credits: 3, semester: 3, track: 'fundamentacion', category: 'Ciencia de los materiales', prereqs: ['fund-mecanica'] },
  { id: 'circuitos-1', code: '2016489', name: 'Circuitos eléctricos I', credits: 3, semester: 3, track: 'profesional', category: 'Circuitos y campos', prereqs: ['taller-electronica'] },

  { id: 'variable-compleja', code: '2015159', name: 'Variable compleja', credits: 4, semester: 4, track: 'fundamentacion', category: 'Matemáticas', prereqs: ['calculo-varias', 'ecuaciones'] },
  { id: 'libre-socio-3', code: 'CLE', name: 'Libre elección · socio-humanística', credits: 3, semester: 4, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'ondas-optica', code: '1000020', name: 'Fundamentos de oscilaciones, ondas y óptica', credits: 4, semester: 4, track: 'fundamentacion', category: 'Física', prereqs: ['ecuaciones', 'fund-electricidad'] },
  { id: 'electronica-analoga-1', code: '2016495', name: 'Electrónica análoga I', credits: 4, semester: 4, track: 'profesional', category: 'Electrónica análoga', prereqs: ['circuitos-1', 'materiales'] },
  { id: 'circuitos-2', code: '2016490', name: 'Circuitos eléctricos II', credits: 4, semester: 4, track: 'profesional', category: 'Circuitos y campos', prereqs: ['circuitos-1'] },

  { id: 'opt-probabilidad', code: 'OPT', name: 'Optativa de probabilidad y estadística', credits: 3, semester: 5, track: 'fundamentacion', category: 'Matemáticas', prereqs: ['calculo-integral'], tag: 'Optativa' },
  { id: 'senales-1', code: '2016506', name: 'Señales y sistemas I', credits: 3, semester: 5, track: 'profesional', category: 'Señales, sistemas y control', prereqs: ['ecuaciones', 'circuitos-1'] },
  { id: 'instrumentacion', code: '2016501', name: 'Instrumentación y medidas', credits: 3, semester: 5, track: 'profesional', category: 'Electrónica análoga', prereqs: ['electronica-analoga-1'] },
  { id: 'electronica-analoga-2', code: '2016496', name: 'Electrónica análoga II', credits: 4, semester: 5, track: 'profesional', category: 'Electrónica análoga', prereqs: ['electronica-analoga-1'] },
  { id: 'electronica-digital-1', code: '2016498', name: 'Electrónica digital I', credits: 4, semester: 5, track: 'profesional', category: 'Electrónica digital', prereqs: ['circuitos-1'] },

  { id: 'semiconductores', code: '2016500', name: 'Física de semiconductores', credits: 3, semester: 6, track: 'fundamentacion', category: 'Física', prereqs: ['materiales'] },
  { id: 'senales-2', code: '2016507', name: 'Señales y sistemas II', credits: 3, semester: 6, track: 'profesional', category: 'Señales, sistemas y control', prereqs: ['senales-1'] },
  { id: 'campos', code: '2016487', name: 'Campos electromagnéticos', credits: 4, semester: 6, track: 'profesional', category: 'Circuitos y campos', prereqs: ['fund-electricidad', 'ondas-optica'] },
  { id: 'opt-analoga', code: 'OPT', name: 'Optativa de electrónica análoga', credits: 3, semester: 6, track: 'profesional', category: 'Electrónica análoga', prereqs: ['electronica-analoga-2'], tag: 'Optativa' },
  { id: 'electronica-digital-2', code: '2016499', name: 'Electrónica digital II', credits: 4, semester: 6, track: 'profesional', category: 'Electrónica digital', prereqs: ['electronica-digital-1'] },

  { id: 'ingenieria-economica', code: '2015703', name: 'Ingeniería económica', credits: 3, semester: 7, track: 'fundamentacion', category: 'Ciencias económicas y administrativas', prereqs: [] },
  { id: 'control', code: '2016493', name: 'Control', credits: 4, semester: 7, track: 'profesional', category: 'Señales, sistemas y control', prereqs: ['senales-2'] },
  { id: 'lineas-antenas', code: '2016503', name: 'Líneas y antenas', credits: 3, semester: 7, track: 'profesional', category: 'Telecomunicaciones', prereqs: ['campos'] },
  { id: 'comunicaciones', code: '2016492', name: 'Comunicaciones', credits: 3, semester: 7, track: 'profesional', category: 'Telecomunicaciones', prereqs: ['senales-2', 'campos'] },
  { id: 'opt-digital', code: 'OPT', name: 'Optativa de electrónica digital', credits: 3, semester: 7, track: 'profesional', category: 'Electrónica digital', prereqs: ['electronica-digital-2'], tag: 'Optativa' },

  { id: 'opt-admin-1', code: 'OPT', name: 'Optativa de administración', credits: 3, semester: 8, track: 'fundamentacion', category: 'Ciencias económicas y administrativas', prereqs: [], tag: 'Optativa' },
  { id: 'libre-profundizacion-1', code: 'CLE', name: 'Libre elección · profundización o complementaria', credits: 3, semester: 8, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'opt-telecomunicaciones', code: '2019125', name: 'Optativa de telecomunicaciones', credits: 3, semester: 8, track: 'profesional', category: 'Telecomunicaciones', prereqs: ['comunicaciones'], tag: 'Optativa' },
  { id: 'potencia', code: '2016497', name: 'Electrónica de potencia', credits: 4, semester: 8, track: 'profesional', category: 'Electrónica análoga', prereqs: ['opt-analoga', 'opt-digital'] },

  { id: 'opt-admin-2', code: 'OPT', name: 'Optativa de administración', credits: 3, semester: 9, track: 'fundamentacion', category: 'Ciencias económicas y administrativas', prereqs: ['opt-admin-1'], tag: 'Optativa' },
  { id: 'libre-profundizacion-2', code: 'CLE', name: 'Libre elección · profundización o complementaria', credits: 3, semester: 9, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'libre-profundizacion-3', code: 'CLE', name: 'Libre elección · profundización o complementaria', credits: 3, semester: 9, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'libre-profundizacion-4', code: 'CLE', name: 'Libre elección · profundización o complementaria', credits: 4, semester: 9, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'taller-proyectos', code: '2016510', name: 'Taller de proyectos interdisciplinarios', credits: 3, semester: 9, track: 'profesional', category: 'Contexto profesional, innovación e investigación', prereqs: [], globalPrereqs: [{ kind: 'regularCredits', value: 121, label: '121 créditos académicos aprobados' }] },

  { id: 'libre-profundizacion-5', code: 'CLE', name: 'Libre elección · profundización o complementaria', credits: 3, semester: 10, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'libre-profundizacion-6', code: 'CLE', name: 'Libre elección · profundización o complementaria', credits: 3, semester: 10, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'libre-profundizacion-7', code: 'CLE', name: 'Libre elección · profundización o complementaria', credits: 3, semester: 10, track: 'electiva', category: 'Libre elección', prereqs: [], tag: 'CLE' },
  { id: 'diseno-sistemas', code: '2016494', name: 'Diseño de sistemas electrónicos', credits: 3, semester: 10, track: 'profesional', category: 'Electrónica digital', prereqs: ['potencia'] },
  { id: 'trabajo-grado', code: '2015316', name: 'Trabajo de grado', credits: 6, semester: 10, track: 'profesional', category: 'Trabajo de grado', prereqs: ['taller-proyectos'], globalPrereqs: [{ kind: 'disciplinaryCredits', value: 63, label: '63 créditos disciplinares aprobados' }], tag: 'Grado' },
]

export const supportSubjects: SupportSubject[] = [
  { id: 'matematicas-basicas', code: '1000001', name: 'Matemáticas básicas', credits: 4, kind: 'nivelacion', prereqs: [] },
  { id: 'lecto-escritura', code: '1000002', name: 'Lecto-escritura', credits: 4, kind: 'nivelacion', prereqs: [] },
  { id: 'ingles-1', code: '1000044', name: 'Inglés I', credits: 3, kind: 'idioma', prereqs: [] },
  { id: 'ingles-2', code: '1000045', name: 'Inglés II', credits: 3, kind: 'idioma', prereqs: ['ingles-1'] },
  { id: 'ingles-3', code: '1000046', name: 'Inglés III', credits: 3, kind: 'idioma', prereqs: ['ingles-2'] },
  { id: 'ingles-4', code: '1000047', name: 'Inglés IV', credits: 3, kind: 'idioma', prereqs: ['ingles-3'] },
]

export const disciplinaryIds = new Set(subjects.filter((subject) => subject.track === 'profesional').map((subject) => subject.id))
