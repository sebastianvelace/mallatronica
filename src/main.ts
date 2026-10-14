import './style.css'
import { mountCurriculumBoard, renderCurriculumBoard, type BoardOptions } from './ui/curriculum-board'
import { courseCodeKey, curriculumMeta, disciplinaryIds, rawCourseCount, subjects, supportSubjects, type PrerequisiteGroup, type PrerequisiteRef, type Subject } from './data/curriculum'
import { normalizeCatalogCourse, readCatalogCourses, type CatalogCourse } from './domain/catalog'
import { readElectiveAssignments, type ElectiveAssignments } from './domain/electives'
import { recordedAverage, readGrades } from './domain/grades'
import { creditBalance } from './domain/credit-balance'

type Status = 'aprobada' | 'reprobada' | 'pendiente'
type View = 'malla' | 'calculadora' | 'horario' | 'libre' | 'info'

type RequirementStatus = 'pendiente' | 'cumplida' | 'exento' | 'no-aplica'
type ScheduleDay = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes'

type ScheduleSlot = {
  id: string
  subjectId: string
  day: ScheduleDay
  start: string
  end: string
  group: string
  room: string
}

type ChoiceCourse = CatalogCourse

type State = {
  schemaVersion: number
  subjects: Record<string, Status>
  notes: Record<string, number>
  theme: 'dark' | 'light'
  connections: boolean
  mathBasics: RequirementStatus
  literacy: RequirementStatus
  english: RequirementStatus
  schedule: ScheduleSlot[]
  freeChoice: ChoiceCourse[]
  freeChoiceStatus: Record<string, Status>
  freeChoiceNotes: Record<string, number>
  electiveAssignments: ElectiveAssignments
}

const totalCredits = curriculumMeta.regularCredits
const semesters = Array.from(new Set(subjects.map((subject) => subject.semester).filter((semester): semester is number => semester !== null))).sort((a, b) => a - b)
const scheduleDays: ScheduleDay[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const defaultState: State = {
  schemaVersion: 6,
  subjects: {},
  notes: {},
  theme: 'light',
  connections: true,
  mathBasics: 'cumplida',
  literacy: 'no-aplica',
  english: 'exento',
  schedule: [],
  freeChoice: [],
  freeChoiceStatus: {},
  freeChoiceNotes: {},
  electiveAssignments: {},
}

const STATE_KEY = 'mallatronica-state-v2'

let state = loadState()
let activeView: View = 'malla'
let disposeBoard = () => {}
let pendingCourseId: string | undefined
let freeChoiceQuery = ''
let freeChoiceCategory = 'all'
let pendingScheduleSubjectId: string | null = null

const app = document.querySelector<HTMLDivElement>('#app')!

function loadState(): State {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return { ...defaultState, subjects: {}, notes: {} }
    const parsed = JSON.parse(raw) as Partial<State>
    return {
      ...defaultState,
      schemaVersion: 6,
      ...parsed,
      theme: (parsed.schemaVersion === 5 || parsed.schemaVersion === 6) && parsed.theme === 'dark' ? 'dark' : 'light',
      subjects: parsed.subjects ?? {},
      notes: readGrades(parsed.notes),
      schedule: Array.isArray(parsed.schedule) ? parsed.schedule.filter(isScheduleSlot) : [],
      freeChoice: readStoredChoiceCourses(parsed.freeChoice),
      freeChoiceStatus: readStatuses(parsed.freeChoiceStatus),
      freeChoiceNotes: readGrades(parsed.freeChoiceNotes),
      electiveAssignments: readElectiveAssignments(parsed.electiveAssignments, readStoredChoiceCourses(parsed.freeChoice)),
    }
  } catch {
    return { ...defaultState, subjects: {}, notes: {}, schedule: [], freeChoice: [] }
  }
}

function readStatuses(value: unknown): Record<string, Status> {
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

function isChoiceCourse(value: unknown): value is ChoiceCourse {
  if (!value || typeof value !== 'object') return false
  const course = value as Partial<ChoiceCourse>
  return typeof course.id === 'string'
    && typeof course.code === 'string'
    && typeof course.name === 'string'
    && typeof course.credits === 'number'
    && course.credits > 0
    && typeof course.category === 'string'
    && (course.source === 'manual' || course.source === 'imported')
}

function readStoredChoiceCourses(value: unknown) {
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

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

function isApproved(subject: Subject) {
  return state.notes[subject.id] !== undefined
    ? state.notes[subject.id] >= 3
    : state.subjects[subject.id] === 'aprobada'
}

function getApprovedCredits() {
  return creditBalance(subjects.filter(isApproved).map(subject => subject.id), getApprovedFreeChoiceCredits()).allocated
}

function isFreeChoiceApproved(course: ChoiceCourse) {
  return state.freeChoiceNotes[course.id] !== undefined
    ? state.freeChoiceNotes[course.id] >= 3
    : state.freeChoiceStatus[course.id] === 'aprobada'
}

function getApprovedFreeChoiceCredits() {
  return state.freeChoice.reduce((sum, course) => sum + (isFreeChoiceApproved(course) ? course.credits : 0), 0)
}

function pruneFreeChoiceProgress() {
  const ids = new Set(state.freeChoice.map(course => course.id))
  state.freeChoiceStatus = Object.fromEntries(Object.entries(state.freeChoiceStatus).filter(([id]) => ids.has(id)))
  state.freeChoiceNotes = Object.fromEntries(Object.entries(state.freeChoiceNotes).filter(([id]) => ids.has(id)))
}

function getApprovedDisciplinaryCredits() {
  return subjects.reduce((sum, subject) => sum + (disciplinaryIds.has(subject.id) && isApproved(subject) ? subject.credits : 0), 0)
}

function subjectForCode(code: string) {
  const key = courseCodeKey(code)
  return subjects.find((subject) => courseCodeKey(subject.code) === key)
}

function prerequisiteSatisfied(reference: PrerequisiteRef) {
  const subject = subjectForCode(reference.code)
  return subject ? isApproved(subject) : false
}

function prerequisiteGroupSatisfied(group: PrerequisiteGroup) {
  const statuses = group.items.map(prerequisiteSatisfied)
  return group.mode === 'all' ? statuses.every(Boolean) : statuses.some(Boolean)
}

function prerequisiteGroupLabel(group: PrerequisiteGroup) {
  const names = group.items.map((item) => `${item.name} (${item.code})`).join(group.mode === 'all' ? ' y ' : ' o ')
  return `Condición ${group.condition}: ${names}`
}

function getMissingRequirements(subject: Subject) {
  const missing = subject.prereqGroups === null
    ? ['Prerrequisitos no publicados por el SIA']
    : subject.prereqGroups.filter((group) => !prerequisiteGroupSatisfied(group)).map(prerequisiteGroupLabel)

  if (subject.id === 'calculo-diferencial' && state.mathBasics === 'pendiente' && supportStatus('matematicas-basicas') !== 'aprobada') missing.unshift('Matemáticas básicas')

  for (const requirement of subject.globalPrereqs ?? []) {
    const current = requirement.kind === 'regularCredits' ? getApprovedCredits() : getApprovedDisciplinaryCredits()
    if (current < requirement.value) missing.push(`${requirement.label} (llevás ${current})`)
  }

  return missing
}

function canApprove(subject: Subject) {
  return getMissingRequirements(subject).length === 0
}

function supportStatus(id: string): Status | 'exento' | 'disponible' | 'bloqueada' {
  if (id === 'matematicas-basicas') {
    if (state.notes[id] !== undefined) return state.notes[id] >= 3 ? 'aprobada' : 'reprobada'
    if (state.mathBasics === 'cumplida') return 'aprobada'
    if (state.mathBasics === 'exento' || state.mathBasics === 'no-aplica') return 'exento'
    return 'pendiente'
  }
  if (id === 'lecto-escritura') {
    if (state.notes[id] !== undefined) return state.notes[id] >= 3 ? 'aprobada' : 'reprobada'
    if (state.literacy === 'cumplida') return 'aprobada'
    if (state.literacy === 'exento' || state.literacy === 'no-aplica') return 'exento'
    return 'pendiente'
  }
  if (state.english === 'exento' || state.english === 'no-aplica') return 'exento'
  const support = supportSubjects.find((item) => item.id === id)!
  if (state.subjects[id] === 'aprobada') return 'aprobada'
  if (state.subjects[id] === 'reprobada') return 'reprobada'
  if (support.prereqGroups === null || support.prereqGroups.length === 0) return 'disponible'
  if (support.prereqGroups.every(prerequisiteGroupSatisfied)) return 'disponible'
  return 'bloqueada'
}

function icon(name: string) {
  const icons: Record<string, string> = {
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    calculator: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M7 6.5h10M7.5 11h.01M12 11h.01M16.5 11h.01M7.5 15h.01M12 15h.01M16.5 15h.01M7.5 19h.01M12 19h.01M16.5 19h.01"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.5h.01"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M4 5.5V22M8 7h8M8 11h8"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V9M7 12l5-5 5 5M4 3h16"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    zap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></svg>',
  }
  return icons[name] ?? ''
}

function getStatus(subject: Subject): Status | 'disponible' | 'parcial' | 'bloqueada' {
  if (state.notes[subject.id] !== undefined) return state.notes[subject.id] >= 3 ? 'aprobada' : 'reprobada'
  if (state.subjects[subject.id]) return state.subjects[subject.id]
  const missing = getMissingRequirements(subject)
  if (missing.length === 0) return 'disponible'
  const total = (subject.prereqGroups?.length ?? 0) + (subject.globalPrereqs?.length ?? 0) + (subject.id === 'calculo-diferencial' && state.mathBasics === 'pendiente' ? 1 : 0)
  const satisfied = total - missing.length
  if (satisfied > 0) return 'parcial'
  return 'bloqueada'
}

function statusInfo(status: ReturnType<typeof getStatus>) {
  const map = {
    aprobada: { label: 'Aprobada', icon: '✓', className: 'approved' },
    reprobada: { label: 'Reprobada', icon: '×', className: 'failed' },
    pendiente: { label: 'Pendiente', icon: '◷', className: 'pending' },
    disponible: { label: 'Disponible', icon: '↗', className: 'available' },
    parcial: { label: 'Parcial', icon: '◒', className: 'partial' },
    bloqueada: { label: 'Bloqueada', icon: '—', className: 'blocked' },
  } as const
  return map[status]
}

function calculateApprovedCredits() {
  return getApprovedCredits()
}

function render() {
  disposeBoard()
  const approvedCredits = calculateApprovedCredits()
  const percentage = Math.round((approvedCredits / totalCredits) * 100)
  document.documentElement.dataset.theme = state.theme
  app.innerHTML = `
    <div class="workspace-shell">
      <main class="main-content">
        <header class="workspace-header">
          <div class="workspace-brand"><span class="brand-name">mallatrónica</span><span class="workspace-campus">UNAL · Bogotá</span></div>
          <nav class="workspace-nav" aria-label="Navegación principal">
            ${navItem('malla', icon('grid'), 'Malla', 'Malla curricular')}
            ${navItem('calculadora', icon('calculator'), 'Notas', 'Notas y promedio')}
            ${navItem('horario', icon('calendar'), 'Horario', 'Horario semanal')}
            ${navItem('libre', icon('book'), 'Libre elección', 'Libre elección')}
            ${navItem('info', icon('info'), 'Ayuda', 'Fuentes y ayuda')}
          </nav>
          <div class="workspace-actions">
            <a class="github-link" href="https://github.com/sebastianvelace/mallatronica" target="_blank" rel="noopener noreferrer" aria-label="Ver el código y contribuir en GitHub (abre otra pestaña)">GitHub ${icon('arrow')}</a>
            <button data-action="theme" aria-label="Cambiar tema" title="Cambiar tema">${icon('sun')}</button>
            <button data-action="export" aria-label="Exportar avance" title="Exportar avance">${icon('download')}<span>Exportar</span></button>
          </div>
        </header>
        ${activeView === 'malla' ? renderMalla(approvedCredits, percentage) : activeView === 'calculadora' ? renderCalculator() : activeView === 'horario' ? renderSchedule() : activeView === 'libre' ? renderFreeChoice() : renderInfo()}
      </main>
    </div>
    <input type="file" id="import-file" accept="application/json" hidden />
    <input type="file" id="catalog-file" accept="application/json" hidden />
  `
  bindEvents()
  disposeBoard = mountCurriculumBoard(app, boardOptions())
  pendingCourseId = undefined
}

function navItem(view: View, svg: string, label: string, accessibleLabel: string) {
  return `<button class="workspace-nav-item ${activeView === view ? 'active' : ''}" data-view="${view}" aria-label="${accessibleLabel}"${activeView === view ? ' aria-current="page"' : ''}>${svg}<span>${label}</span></button>`
}

function renderMalla(approvedCredits: number, percentage: number) {
  const average = recordedAverage(state.notes, state.freeChoice, state.freeChoiceNotes)
  return `
    <section class="curriculum-heading"><div><p>UNAL Bogotá <span>/</span> Plan 2545</p><h1>Ingeniería Electrónica<span>.</span></h1><p>Tu carrera, materia por materia.</p></div><div class="curriculum-metrics"><div class="recorded-average"><span>Promedio registrado</span><strong data-recorded-average>${average.value?.toFixed(2) ?? 'Sin notas'}</strong><small>${average.courses} materias · ${average.credits} créditos con nota</small><details><summary>¿Es mi PAPA?</summary><p>Es una estimación ponderada por créditos. Incluye notas numéricas del plan, libre elección, Matemáticas Básicas y Lectoescritura. Inglés AP/RE y aprobaciones sin nota no se ponderan. Todavía no representa intentos repetidos ni reemplaza el PAPA oficial.</p></details></div><div class="curriculum-progress"><strong>${approvedCredits}<span> / ${totalCredits} cr.</span></strong><div role="progressbar" aria-label="Créditos aprobados" aria-valuenow="${Math.min(100, percentage)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, percentage)}%"></i></div><small>${percentage}% del plan registrado</small></div></div></section>
    ${renderCreditBalance()}
    ${renderCurriculumBoard(boardOptions())}
    <details class="curriculum-support"><summary>Nivelación y lengua extranjera <span>Configurar mi situación</span></summary>${renderSupportTracks()}</details>
    <footer class="curriculum-footer"><span>Avance guardado en este navegador · oferta y requisitos finales en el SIA</span><div><button class="text-button" data-action="import">Importar avance</button><button class="text-button" data-view="info">Fuentes y alcance</button><button class="text-button" data-action="reset">Reiniciar</button></div></footer>
  `
}

function renderCreditBalance() {
  const balance = creditBalance(subjects.filter(isApproved).map(subject => subject.id), getApprovedFreeChoiceCredits())
  return `<details class="curriculum-support credit-balance"><summary>Balance de créditos <span>Requisitos por componente · ${balance.required} créditos</span></summary>
    <p>Estimación por componente, no certificación de grado. Las agrupaciones de optativas aún necesitan validación; los excedentes no pasan automáticamente a libre elección.</p>
    <div class="credit-balance-table"><table><caption>Créditos registrados y exigidos</caption><thead><tr><th scope="col">Componente</th><th scope="col">Registrados</th><th scope="col">Exigidos</th><th scope="col">Faltantes estimados</th></tr></thead><tbody>${balance.rows.map(row => `<tr><th scope="row">${row.category}</th><td>${row.recorded}</td><td>${row.required}</td><td>${row.remaining}</td></tr>`).join('')}</tbody></table></div>
    <p>Trabajo de grado aporta como máximo 6 créditos al balance, aunque registres ambas alternativas. Libre elección aporta como máximo 34 créditos registrados. La nivelación es individual y no se suma a los 172 créditos.</p>
    <p>Fuente: resumen SIA del plan 2545, consulta del 13 de octubre de 2026. No se importó progreso personal.</p></details>`
}

function boardOptions(): BoardOptions {
  return {
    status: getStatus,
    missing: getMissingRequirements,
    approved: isApproved,
    note: (id) => state.notes[id],
    inspectId: pendingCourseId,
    electiveAssignments: state.electiveAssignments,
    freeChoices: state.freeChoice,
    assignElective: (key, id) => {
      const next = { ...state.electiveAssignments }
      if (id) next[key] = id
      else delete next[key]
      state.electiveAssignments = readElectiveAssignments(next, state.freeChoice)
      saveState(); render()
      app.querySelector<HTMLButtonElement>(`[data-slot-key="${key}"]`)?.focus({ preventScroll: true })
    },
    saveGrade: (subject, grade) => {
      if (grade !== undefined && (!Number.isFinite(grade) || grade < 0 || grade > 5)) return
      if (grade === undefined) {
        if (state.notes[subject.id] !== undefined) state.subjects[subject.id] = isApproved(subject) ? 'aprobada' : 'reprobada'
        delete state.notes[subject.id]
      } else state.notes[subject.id] = grade
      pendingCourseId = subject.id
      saveState(); render()
    },
    update: (subject, status) => {
      if (state.notes[subject.id] !== undefined) return
      if (status === 'aprobada' && !canApprove(subject)) { showRequirementToast(subject); return }
      if (status === 'clear') delete state.subjects[subject.id]
      else state.subjects[subject.id] = status
      pendingCourseId = subject.id
      saveState()
      render()
    },
    schedule: (subject) => {
      pendingScheduleSubjectId = subject.id
      activeView = 'horario'
      render()
    },
  }
}

function renderSupportTracks() {
  const profileSelect = (key: 'mathBasics' | 'literacy' | 'english', label: string) => {
    const value = state[key]
    const options = key === 'english'
      ? `<option value="exento" ${value === 'exento' ? 'selected' : ''}>Acreditado sin nota</option><option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>Debo cursar niveles</option>`
      : `<option value="cumplida" ${value === 'cumplida' ? 'selected' : ''}>La cursé y aprobé</option><option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>Debo cursarla / la reprobé</option><option value="no-aplica" ${value === 'no-aplica' ? 'selected' : ''}>No me fue exigida</option>`
    return `<label class="profile-select"><span>${label}</span><select data-profile="${key}" aria-label="Estado de ${label}">${options}</select></label>`
  }
  const track = (kind: 'nivelacion' | 'idioma', title: string, description: string) => {
    const subjectsForTrack = supportSubjects.filter((subject) => subject.kind === kind)
    const rows = subjectsForTrack.map((subject) => {
      const status = supportStatus(subject.id)
      const info = status === 'exento'
        ? { label: 'No exigida', icon: '—', className: 'exempt' }
        : statusInfo(status === 'disponible' ? 'disponible' : status)
      const interactive = kind === 'idioma' && state.english === 'pendiente'
      const grade = kind === 'nivelacion' && status !== 'exento'
        ? `<label class="support-grade"><span>Nota</span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`
        : ''
      const row = `<div class="support-subject"><strong>${subject.name}</strong><small>${subject.code} · ${subject.credits} créditos adicionales</small></div><div class="support-row-actions">${grade}<span class="support-status ${info.className}">${info.icon} ${info.label}</span></div>`
      return interactive ? `<button type="button" class="support-row support-row-button" data-support-id="${subject.id}">${row}</button>` : `<div class="support-row">${row}</div>`
    }).join('')
    const selectors = kind === 'idioma'
      ? profileSelect('english', 'Lengua extranjera')
      : `<div class="profile-selects">${profileSelect('mathBasics', 'Matemáticas básicas')}${profileSelect('literacy', 'Lecto-escritura')}</div>`
    const content = kind === 'idioma' && state.english === 'exento'
      ? `<div class="language-accreditation"><strong>12 créditos acreditados</strong><span>Registrados como aprobado, sin calificación numérica</span><small>Cumplen el requisito de idioma, pero no entran al promedio.</small></div>`
      : kind === 'idioma'
        ? `<details class="language-routes"><summary>Elegir únicamente la ruta que aparece en mi historia <span>${subjectsForTrack.length} modalidades del catálogo</span></summary><p>Semestral, virtual, intensiva y suficiencia son alternativas. No debés aprobarlas todas.</p><div class="support-list">${rows}</div></details>`
        : `<div class="support-list">${rows}</div>`
    return `<article class="support-card"><div class="support-head"><div><span class="panel-kicker">Ruta adicional</span><h2>${title}</h2></div>${selectors}</div><p>${description}</p>${content}</article>`
  }
  return `<section class="support-tracks"><div class="support-intro"><span class="panel-kicker">Fuera de los 172 créditos regulares</span><h2>Tu situación también importa.</h2><p>Las notas numéricas de Matemáticas Básicas y Lectoescritura afectan el promedio. Inglés acredita el requisito como aprobado o reprobado, sin nota numérica.</p></div><div class="support-grid">${track('nivelacion', 'Nivelación', 'Son créditos adicionales: cuentan en el promedio cuando tienen nota, pero no dentro de los 172 del plan.')}${track('idioma', 'Lengua extranjera', 'La suficiencia acredita 12 créditos adicionales como aprobado, sin modificar el promedio.')}</div></section>`
}

function renderCalculator() {
  const entries = Object.entries(state.notes)
  const regularEntries = entries.filter(([id]) => subjects.some((item) => item.id === id))
  const levelingEntries = entries.filter(([id]) => supportSubjects.some((item) => item.id === id && item.kind === 'nivelacion'))
  const freeChoiceEntries = Object.entries(state.freeChoiceNotes).filter(([id]) => state.freeChoice.some((item) => item.id === id))
  const average = recordedAverage(state.notes, state.freeChoice, state.freeChoiceNotes)
  const credits = average.credits
  const papa = average.value?.toFixed(2) ?? 'Sin notas'
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Historial académico</div><h1>Que tus notas <em>cuenten.</em></h1><p class="lede">Registrá las calificaciones por materia y dejá que la ruta se actualice sola.</p></div><div class="heading-note"><span>REGLA DE CÁLCULO</span><strong>Σ (nota × créditos) / Σ créditos</strong><small>Escala de 0.0 a 5.0 · aprobación desde 3.0</small></div></section>
  <section class="metric-grid"><div class="metric-card accent"><span>Promedio registrado</span><strong>${papa}</strong><small>Sobre ${credits} créditos con nota numérica</small></div><div class="metric-card"><span>Créditos ponderados</span><strong>${credits}</strong><small>Plan, libre elección y nivelación numérica</small></div><div class="metric-card"><span>Materias calificadas</span><strong>${regularEntries.length + levelingEntries.length + freeChoiceEntries.length}</strong><small>Inglés AP/RE no se pondera</small></div></section>
  <section class="calculator-layout"><div class="panel"><div class="panel-heading"><div><span class="panel-kicker">Historial</span><h2>Notas por materia</h2></div></div>${renderLevelingSemester(levelingEntries.length > 0)}${semesters.map((semester) => renderGradeSemester(semester)).join('')}${subjects.some((subject) => subject.semester === null) ? renderGradeSemester(null) : ''}${renderFreeChoiceGrades()}</div><aside class="side-note"><span class="side-note-icon">${icon('zap')}</span><h3>Solo se ponderan números.</h3><p>Matemáticas Básicas y Lectoescritura entran al promedio si tienen nota numérica. Inglés acreditado como AP/RE cumple el requisito, pero no se convierte artificialmente en 3.0 o 5.0.</p><button class="text-button" data-view="malla">Volver a la malla ${icon('arrow')}</button></aside></section>`
}

function renderFreeChoiceGrades() {
  if (!state.freeChoice.length) return ''
  const hasAny = Object.keys(state.freeChoiceNotes).some(id => state.freeChoice.some(course => course.id === id))
  return `<div class="grade-semester free-choice-semester"><div class="grade-semester-title"><span>LE</span><strong>Libre elección</strong><small>${hasAny ? 'En progreso' : 'Sin registrar'}</small></div><p class="leveling-note">Estas notas sí entran en el promedio registrado. La aplicación limita su aporte al avance a 34 créditos.</p><div class="grade-rows">${state.freeChoice.map(course => `<label class="grade-row"><span>${escapeHtml(course.name)}<small>${course.credits} créditos · ${escapeHtml(course.code)}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.freeChoiceNotes[course.id] ?? ''}" placeholder="—" data-free-note="${escapeHtml(course.id)}" aria-label="Nota de ${escapeHtml(course.name)}" /></label>`).join('')}</div></div>`
}

function renderLevelingSemester(hasAny: boolean) {
  const levelingSubjects = supportSubjects.filter((subject) => subject.kind === 'nivelacion')
  return `<div class="grade-semester leveling-semester"><div class="grade-semester-title"><span>00</span><strong>Nivelación con nota numérica</strong><small>${hasAny ? 'Incluida en el promedio' : 'Sin registrar'}</small></div><p class="leveling-note">Matemáticas Básicas y Lectoescritura tienen créditos adicionales: se ponderan en el promedio, pero no suman a los 172 créditos del plan. Inglés AP/RE se gestiona desde la malla y no entra aquí.</p><div class="grade-rows">${levelingSubjects.map((subject) => `<label class="grade-row"><span>${subject.name}<small>${subject.credits} créditos adicionales · ${subject.code}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`).join('')}</div></div>`
}

function renderGradeSemester(semester: number | null) {
  const semesterSubjects = subjects.filter((subject) => subject.semester === semester)
  const hasAny = semesterSubjects.some((subject) => state.notes[subject.id] !== undefined)
  return `<div class="grade-semester"><div class="grade-semester-title"><span>${semester === null ? 'SIA' : String(semester).padStart(2, '0')}</span><strong>${semester === null ? 'Materias del catálogo sin semestre asignado' : `Semestre ${semester}`}</strong><small>${hasAny ? 'En progreso' : 'Sin registrar'}</small></div><div class="grade-rows">${semesterSubjects.map((subject) => `<label class="grade-row"><span>${subject.name}<small>${subject.credits} créditos · ${subject.code}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`).join('')}</div></div>`
}

function getScheduleCourses() {
  return [...subjects, ...state.freeChoice]
}

function getScheduleCourse(id: string) {
  return getScheduleCourses().find((course) => course.id === id)
}

function renderFreeChoice() {
  const categories = Array.from(new Set(state.freeChoice.map((course) => course.category))).sort((a, b) => a.localeCompare(b))
  const query = freeChoiceQuery.trim().toLocaleLowerCase()
  const visibleCourses = state.freeChoice.filter((course) => {
    const matchesQuery = !query || `${course.name} ${course.code}`.toLocaleLowerCase().includes(query)
    const matchesCategory = freeChoiceCategory === 'all' || course.category === freeChoiceCategory
    return matchesQuery && matchesCategory
  })
  const catalogContent = state.freeChoice.length
    ? visibleCourses.length
      ? `<div class="choice-grid">${visibleCourses.map(renderFreeChoiceCard).join('')}</div>`
      : `<div class="catalog-empty"><h2>No hay coincidencias</h2><p>Probá con otro nombre, código o componente.</p></div>`
    : `<div class="catalog-empty"><div class="empty-orbit">${icon('book')}</div><h2>Catálogo todavía no importado</h2><p>El SIA ofrece un buscador oficial por asignatura, plan, horario y tipología. Importá aquí un JSON exportado o agregá materias manualmente mientras conectamos esa fuente.</p><button class="button button-solid" data-action="import-catalog">Importar catálogo JSON</button></div>`

  const approvedCredits = getApprovedFreeChoiceCredits()
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Catálogo personal</div><h1>Elegí con <em>criterio.</em></h1><p class="lede">Guardá opciones, registrá su resultado y pasalas al horario sin confundirlas con una oferta oficial.</p></div><div class="heading-note"><span>LIBRE ELECCIÓN REGISTRADA</span><strong>${Math.min(34, approvedCredits)} / 34 créditos</strong><small>${approvedCredits > 34 ? `${approvedCredits - 34} créditos excedentes · ` : ''}validar en SIA</small></div></section>
  <section class="catalog-toolbar"><form data-choice-search><label><span>Buscar</span><input name="query" value="${escapeHtml(freeChoiceQuery)}" placeholder="Nombre o código" /></label><label><span>Componente</span><select name="category"><option value="all">Todos</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${freeChoiceCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></label><button class="button button-outline" type="submit">Filtrar</button></form><div class="toolbar-controls"><button class="button button-quiet" type="button" data-action="import-catalog">Importar JSON</button></div></section>
  <section class="choice-entry"><form data-choice-form><div><span class="panel-kicker">Agregar opción</span><p>Usá datos que hayas verificado en el SIA.</p></div><label><span>Código</span><input name="code" maxlength="30" placeholder="Ej. 201XXXX" required /></label><label class="choice-name-field"><span>Nombre</span><input name="name" maxlength="100" placeholder="Nombre de la asignatura" required /></label><label><span>Créditos</span><input name="credits" type="number" min="1" max="12" step="1" value="3" required /></label><label><span>Componente</span><input name="category" maxlength="60" placeholder="Ej. 2CLE" required /></label><button class="button button-solid" type="submit">Guardar opción ${icon('arrow')}</button></form></section>
  <section class="choice-results"><div class="map-caption"><span><strong>OPCIONES GUARDADAS</strong> · ${visibleCourses.length} visibles</span><span class="map-help">Se guardan solo en este navegador</span></div>${catalogContent}</section>`
}

function renderFreeChoiceCard(course: ChoiceCourse) {
  const grade = state.freeChoiceNotes[course.id]
  const approved = isFreeChoiceApproved(course)
  const status = grade !== undefined ? (approved ? 'Aprobada' : 'Reprobada') : approved ? 'Aprobada' : 'Pendiente'
  return `<article class="choice-card ${approved ? 'is-approved' : ''}"><div class="choice-card-top"><span class="subject-code">${escapeHtml(course.code)}</span><span class="choice-status">${status}</span></div><h3>${escapeHtml(course.name)}</h3><p>${escapeHtml(course.category)} · ${course.source === 'imported' ? 'Importada' : 'Manual'}</p><div class="choice-progress"><label><span>Nota opcional</span><input type="number" min="0" max="5" step="0.1" value="${grade ?? ''}" placeholder="—" data-free-note="${escapeHtml(course.id)}" aria-label="Nota de ${escapeHtml(course.name)}" /></label><button class="button button-quiet" type="button" data-free-approved="${escapeHtml(course.id)}" ${grade !== undefined ? 'disabled' : ''}>${grade !== undefined ? 'Estado por nota' : approved ? 'Quitar aprobación' : 'Marcar aprobada'}</button></div><div class="choice-card-bottom"><span>${course.credits} créditos</span><div><button class="text-button" data-choice-schedule="${escapeHtml(course.id)}">Al horario ${icon('arrow')}</button><button class="choice-remove" type="button" data-choice-remove="${escapeHtml(course.id)}" aria-label="Eliminar ${escapeHtml(course.name)}">×</button></div></div></article>`
}

function renderSchedule() {
  const slotCount = state.schedule.length
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Planeación semanal</div><h1>Armá tu <em>semana.</em></h1><p class="lede">Agregá tus bloques manualmente y detectá choques antes de armar la matrícula.</p></div><div class="heading-note"><span>FUENTE</span><strong>Carga manual</strong><small>Los grupos del SIA todavía no están conectados</small></div></section>
  <section class="schedule-toolbar"><div><span class="panel-kicker">Tu horario</span><h2>${slotCount ? `${slotCount} bloque${slotCount === 1 ? '' : 's'} guardado${slotCount === 1 ? '' : 's'}` : 'Todavía no hay bloques'}</h2></div><div class="toolbar-controls"><button class="button button-outline" data-action="copy-schedule" ${slotCount ? '' : 'disabled'}>${icon('download')} Copiar</button><button class="button button-solid" data-action="print-schedule">Imprimir</button><button class="text-button" data-action="clear-schedule" ${slotCount ? '' : 'disabled'}>Vaciar</button></div></section>
  <section class="schedule-workspace"><form class="schedule-form" data-schedule-form><div class="schedule-form-head"><span class="panel-kicker">Agregar bloque</span><p>Solo guardamos estos datos en tu navegador.</p></div><label><span>Materia</span><select name="subjectId" required>${getScheduleCourses().map((subject) => `<option value="${subject.id}" ${pendingScheduleSubjectId === subject.id ? 'selected' : ''}>${subject.name} · ${subject.code}</option>`).join('')}</select></label><div class="schedule-form-grid"><label><span>Día</span><select name="day">${scheduleDays.map((day) => `<option value="${day}">${day}</option>`).join('')}</select></label><label><span>Grupo</span><input name="group" maxlength="20" placeholder="Opcional" /></label><label><span>Inicio</span><input name="start" type="time" value="07:00" required /></label><label><span>Fin</span><input name="end" type="time" value="09:00" required /></label><label><span>Salón</span><input name="room" maxlength="30" placeholder="Opcional" /></label></div><button class="button button-solid" type="submit">Agregar al horario ${icon('arrow')}</button></form><aside class="schedule-note"><span class="side-note-icon">${icon('zap')}</span><h3>Primero una versión verificable.</h3><p>No inventamos grupos, profesores ni cupos. Cuando tengamos una fuente SIA confirmada, esta misma vista podrá importar la oferta oficial.</p></aside></section>
  <div class="week-grid"><div class="time-axis"><span>07:00</span><span>09:00</span><span>11:00</span><span>13:00</span><span>15:00</span><span>17:00</span></div>${scheduleDays.map((day) => `<div class="day-column"><strong>${day}</strong><div class="day-lines">${state.schedule.filter((slot) => slot.day === day).sort((a, b) => a.start.localeCompare(b.start)).map(renderScheduleSlot).join('') || '<span class="day-empty">Sin bloques</span>'}</div></div>`).join('')}</div>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}

function renderScheduleSlot(slot: ScheduleSlot) {
  const subject = getScheduleCourse(slot.subjectId)
  const details = [slot.group && `Grupo ${escapeHtml(slot.group)}`, slot.room && escapeHtml(slot.room)].filter(Boolean).join(' · ')
  return `<article class="schedule-block"><div class="schedule-block-time">${slot.start}–${slot.end}</div><strong>${subject?.name ?? 'Materia eliminada'}</strong>${details ? `<small>${details}</small>` : ''}<button type="button" data-schedule-remove="${slot.id}" aria-label="Quitar ${subject?.name ?? 'bloque'}">×</button></article>`
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function scheduleHasConflict(candidate: ScheduleSlot) {
  const candidateStart = timeToMinutes(candidate.start)
  const candidateEnd = timeToMinutes(candidate.end)
  return state.schedule.some((slot) => slot.day === candidate.day
    && candidateStart < timeToMinutes(slot.end)
    && candidateEnd > timeToMinutes(slot.start))
}

function scheduleAsText() {
  return scheduleDays.map((day) => {
    const slots = state.schedule.filter((slot) => slot.day === day).sort((a, b) => a.start.localeCompare(b.start))
    if (!slots.length) return `${day}: sin bloques`
    return `${day}:\n${slots.map((slot) => {
      const subject = getScheduleCourse(slot.subjectId)
      const details = [slot.group && `grupo ${slot.group}`, slot.room && slot.room].filter(Boolean).join(' · ')
      return `  ${slot.start}-${slot.end} · ${subject?.name ?? 'Materia'}${details ? ` · ${details}` : ''}`
    }).join('\n')}`
  }).join('\n')
}

function renderInfo() {
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Centro de ayuda</div><h1>Lo importante, <em>a mano.</em></h1><p class="lede">Fuentes oficiales, alcance del plan y configuración de tu ruta personal.</p></div><div class="heading-note"><span>FUENTE</span><strong>Plan ${curriculumMeta.plan}</strong><small>${curriculumMeta.sourceLabel}</small></div></section><section class="info-grid"><article class="info-card wide"><div class="info-card-head"><span class="info-index">01</span><h2>Fuentes y alcance</h2></div><p>Mallatrónica es una herramienta independiente. No reemplaza el SIA ni la asesoría de la coordinación curricular.</p><div class="source-row"><span class="source-dot"></span><span>Catálogo público SIA · ${rawCourseCount} registros del Plan ${curriculumMeta.plan}.</span><span class="source-status verified">Fuente primaria</span></div><div class="source-row"><span class="source-dot"></span><span>Tu avance y tu ruta se quedan en este navegador.</span><span class="source-status verified">Privacidad local</span></div><div class="source-row"><span class="source-dot"></span><span>Semestres, agrupaciones y libre elección no vienen publicados en esta extracción.</span><span class="source-status">Dato incompleto</span></div></article><article class="info-card"><div class="info-card-head"><span class="info-index">02</span><h2>Enlaces oficiales</h2></div><div class="link-list"><a href="https://unal.edu.co" target="_blank" rel="noreferrer">Universidad Nacional de Colombia ${icon('arrow')}</a><a href="https://ingenieria.bogota.unal.edu.co" target="_blank" rel="noreferrer">Facultad de Ingeniería ${icon('arrow')}</a><a href="https://siabog.unal.edu.co/academia/libre-acceso/faq.do" target="_blank" rel="noreferrer">SIA · preguntas frecuentes ${icon('arrow')}</a><a href="https://siabog.unal.edu.co/academia/libre-acceso/manuales/539019aa08a39d44dc7c45e1a888f821.pdf" target="_blank" rel="noreferrer">Guía oficial del buscador ${icon('arrow')}</a></div></article><article class="info-card"><div class="info-card-head"><span class="info-index">03</span><h2>Tu ruta personal</h2></div><p class="muted">Configurá nivelación y lengua extranjera desde la malla. En tu caso actual quedan como Matemáticas básicas cumplida e Inglés exento.</p><button class="button button-outline full-width" data-view="malla">Editar en la malla ${icon('arrow')}</button></article></section><div class="legal-note"><span>Nota de confianza</span><p>El catálogo SIA aporta asignaturas y prerrequisitos, pero no publica aquí todos los requisitos de grado, la distribución de libre elección ni los semestres sugeridos. Contrastá siempre la vigencia con el SIA.</p></div>`
}

function bindEvents() {
  app.querySelectorAll<HTMLElement>('[data-view]').forEach((element) => element.addEventListener('click', () => {
    activeView = element.dataset.view as View
    render()
  }))
  app.querySelector<HTMLElement>('[data-action="theme"]')?.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; saveState(); render() })
  app.querySelector<HTMLElement>('[data-action="reset"]')?.addEventListener('click', () => {
    if (window.confirm('¿Reiniciar todas las marcas manuales y notas?')) { state.subjects = {}; state.notes = {}; state.freeChoiceStatus = {}; state.freeChoiceNotes = {}; saveState(); render() }
  })
  app.querySelector<HTMLElement>('[data-action="export"]')?.addEventListener('click', exportState)
  app.querySelector<HTMLElement>('[data-action="import"]')?.addEventListener('click', () => app.querySelector<HTMLInputElement>('#import-file')?.click())
  app.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', importState)
  app.querySelector<HTMLElement>('[data-action="import-catalog"]')?.addEventListener('click', () => app.querySelector<HTMLInputElement>('#catalog-file')?.click())
  app.querySelector<HTMLInputElement>('#catalog-file')?.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = readCatalogCourses(JSON.parse(String(reader.result)))
        if (!imported.length) throw new Error('empty')
        state.freeChoice = imported
        pruneFreeChoiceProgress()
        state.electiveAssignments = readElectiveAssignments(state.electiveAssignments, state.freeChoice)
        saveState()
        render()
        showSupportToast('Catálogo importado', `${imported.length} opciones quedaron guardadas localmente.`)
      } catch {
        showSupportToast('No se pudo importar', 'Usá un JSON con code, name, credits y category por cada materia.')
      }
      input.value = ''
    }
    reader.readAsText(file)
  })
  app.querySelector<HTMLFormElement>('[data-choice-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    const course = normalizeCatalogCourse({ code: data.get('code'), name: data.get('name'), credits: data.get('credits'), category: data.get('category') }, state.freeChoice.length, 'manual')
    if (!course) {
      showSupportToast('Faltan datos', 'Completá código, nombre, créditos y componente.')
      return
    }
    state.freeChoice.push(course)
    saveState()
    render()
  })
  app.querySelector<HTMLFormElement>('[data-choice-search]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    freeChoiceQuery = String(data.get('query') ?? '')
    freeChoiceCategory = String(data.get('category') ?? 'all')
    render()
  })
  app.querySelectorAll<HTMLElement>('[data-choice-schedule]').forEach((element) => element.addEventListener('click', () => {
    pendingScheduleSubjectId = element.dataset.choiceSchedule ?? null
    activeView = 'horario'
    render()
  }))
  app.querySelectorAll<HTMLElement>('[data-choice-remove]').forEach((element) => element.addEventListener('click', () => {
    const id = element.dataset.choiceRemove
    const course = state.freeChoice.find((item) => item.id === id)
    if (!id || !course || !window.confirm(`¿Eliminar ${course.name} del catálogo local?`)) return
    state.freeChoice = state.freeChoice.filter((item) => item.id !== id)
    delete state.freeChoiceStatus[id]
    delete state.freeChoiceNotes[id]
    state.electiveAssignments = readElectiveAssignments(state.electiveAssignments, state.freeChoice)
    state.schedule = state.schedule.filter((slot) => slot.subjectId !== id)
    saveState()
    render()
  }))
  app.querySelector<HTMLFormElement>('[data-schedule-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const data = new FormData(form)
    const candidate: ScheduleSlot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subjectId: String(data.get('subjectId') ?? ''),
      day: String(data.get('day') ?? 'Lunes') as ScheduleDay,
      start: String(data.get('start') ?? ''),
      end: String(data.get('end') ?? ''),
      group: String(data.get('group') ?? '').trim(),
      room: String(data.get('room') ?? '').trim(),
    }
    if (!candidate.subjectId || !scheduleDays.includes(candidate.day) || !candidate.start || !candidate.end) return
    if (timeToMinutes(candidate.end) <= timeToMinutes(candidate.start)) {
      showSupportToast('El bloque no se puede agregar', 'La hora de fin debe ser posterior a la hora de inicio.')
      return
    }
    if (scheduleHasConflict(candidate)) {
      showSupportToast('Hay un choque de horario', `Ya tenés otro bloque el ${candidate.day} en ese intervalo.`)
      return
    }
    state.schedule.push(candidate)
    pendingScheduleSubjectId = null
    saveState()
    render()
  })
  app.querySelectorAll<HTMLElement>('[data-schedule-remove]').forEach((element) => element.addEventListener('click', () => {
    state.schedule = state.schedule.filter((slot) => slot.id !== element.dataset.scheduleRemove)
    saveState()
    render()
  }))
  app.querySelector<HTMLElement>('[data-action="copy-schedule"]')?.addEventListener('click', async () => {
    if (!state.schedule.length) return
    try {
      await navigator.clipboard.writeText(scheduleAsText())
      showSupportToast('Horario copiado', 'Ya podés pegarlo en tus notas o compartirlo.')
    } catch {
      showSupportToast('No se pudo copiar', 'Tu navegador bloqueó el portapapeles. Usá Imprimir o copiá los bloques manualmente.')
    }
  })
  app.querySelector<HTMLElement>('[data-action="print-schedule"]')?.addEventListener('click', () => window.print())
  app.querySelector<HTMLElement>('[data-action="clear-schedule"]')?.addEventListener('click', () => {
    if (!state.schedule.length || !window.confirm('¿Vaciar todos los bloques del horario?')) return
    state.schedule = []
    saveState()
    render()
  })
  app.querySelectorAll<HTMLInputElement>('[data-note]').forEach((input) => input.addEventListener('change', () => {
    const id = input.dataset.note!
    const value = input.value === '' ? undefined : Number(input.value)
    if (value === undefined || Number.isNaN(value)) delete state.notes[id]
    else {
      state.notes[id] = Math.round(Math.min(5, Math.max(0, value)) * 10) / 10
      if (id === 'matematicas-basicas') state.mathBasics = state.notes[id] >= 3 ? 'cumplida' : 'pendiente'
      if (id === 'lecto-escritura') state.literacy = state.notes[id] >= 3 ? 'cumplida' : 'pendiente'
    }
    saveState(); render()
  }))
  app.querySelectorAll<HTMLInputElement>('[data-free-note]').forEach((input) => input.addEventListener('change', () => {
    const id = input.dataset.freeNote!
    if (!state.freeChoice.some(course => course.id === id)) return
    const value = input.value === '' ? undefined : Number(input.value)
    if (value === undefined || Number.isNaN(value)) delete state.freeChoiceNotes[id]
    else state.freeChoiceNotes[id] = Math.min(5, Math.max(0, value))
    saveState(); render()
  }))
  app.querySelectorAll<HTMLButtonElement>('[data-free-approved]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.freeApproved!
    const course = state.freeChoice.find(item => item.id === id)
    if (!course || state.freeChoiceNotes[id] !== undefined) return
    state.freeChoiceStatus[id] = isFreeChoiceApproved(course) ? 'pendiente' : 'aprobada'
    saveState(); render()
  }))
  app.querySelectorAll<HTMLSelectElement>('[data-profile]').forEach((select) => select.addEventListener('change', () => {
    const key = select.dataset.profile as 'mathBasics' | 'literacy' | 'english'
    state[key] = select.value as RequirementStatus
    const subjectId = key === 'mathBasics' ? 'matematicas-basicas' : key === 'literacy' ? 'lecto-escritura' : undefined
    const grade = subjectId ? state.notes[subjectId] : undefined
    if (subjectId && grade !== undefined) {
      const contradictsGrade = select.value === 'no-aplica'
        || (select.value === 'pendiente' && grade >= 3)
        || (select.value === 'cumplida' && grade < 3)
      if (contradictsGrade) {
        delete state.notes[subjectId]
        showSupportToast('Estado actualizado', 'Se quitó la nota anterior porque contradecía la nueva situación seleccionada.')
      }
    }
    saveState(); render()
  }))
  app.querySelectorAll<HTMLButtonElement>('[data-support-id]').forEach((button) => button.addEventListener('click', () => {
    const support = supportSubjects.find((subject) => subject.id === button.dataset.supportId)
    if (!support) return
    const missing = support.prereqGroups?.filter((group) => !prerequisiteGroupSatisfied(group)).map(prerequisiteGroupLabel) ?? []
    if (missing.length) { showSupportToast(`${support.name} sigue bloqueado`, `Primero completá ${missing.join(', ')}`); return }
    state.subjects[support.id] = state.subjects[support.id] === 'aprobada' ? 'pendiente' : 'aprobada'
    saveState(); render()
  }))
  app.querySelectorAll<HTMLElement>('[data-action="placeholder-link"]').forEach((element) => element.addEventListener('click', (event) => { event.preventDefault(); window.alert('Este enlace queda pendiente de verificación oficial.') }))
  app.querySelector<HTMLElement>('[data-action="add-semester"]')?.addEventListener('click', () => window.alert('Podés registrar las notas directamente en cada fila de semestre.'))
  app.querySelector<HTMLElement>('[data-action="save-link"]')?.addEventListener('click', () => window.alert('La función de enlaces personales estará disponible en la próxima iteración.'))
}

function showRequirementToast(subject: Subject) {
  document.querySelector('.requirement-toast')?.remove()
  const toast = document.createElement('div')
  toast.className = 'requirement-toast'
  toast.innerHTML = `<strong>${subject.name} sigue bloqueada</strong><span>${getMissingRequirements(subject).slice(0, 3).join(' · ')}</span>`
  document.body.appendChild(toast)
  window.setTimeout(() => toast.remove(), 4200)
}

function showSupportToast(title: string, message: string) {
  document.querySelector('.requirement-toast')?.remove()
  const toast = document.createElement('div')
  toast.className = 'requirement-toast'
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`
  document.body.appendChild(toast)
  window.setTimeout(() => toast.remove(), 4200)
}

function exportState() {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'mallatronica-avance.json'; anchor.click(); URL.revokeObjectURL(url)
}

function importState(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const imported = JSON.parse(String(reader.result)) as Partial<State>
      if (!imported.subjects || typeof imported.subjects !== 'object') throw new Error('invalid')
      state = {
        ...defaultState,
        ...imported,
        schemaVersion: 6,
        subjects: imported.subjects,
        notes: readGrades(imported.notes),
        theme: (imported.schemaVersion === 5 || imported.schemaVersion === 6) && imported.theme === 'dark' ? 'dark' : 'light',
        schedule: Array.isArray(imported.schedule) ? imported.schedule.filter(isScheduleSlot) : [],
        freeChoice: readStoredChoiceCourses(imported.freeChoice),
        freeChoiceStatus: readStatuses(imported.freeChoiceStatus),
        freeChoiceNotes: readGrades(imported.freeChoiceNotes),
        electiveAssignments: readElectiveAssignments(imported.electiveAssignments, readStoredChoiceCourses(imported.freeChoice)),
      }
      pruneFreeChoiceProgress()
      saveState(); render(); window.alert('Avance importado correctamente.')
    } catch { window.alert('Ese archivo no tiene un formato de avance válido.') }
    input.value = ''
  }
  reader.readAsText(file)
}

render()
