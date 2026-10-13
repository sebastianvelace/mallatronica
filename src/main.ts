import './style.css'
import { curriculumMeta, disciplinaryIds, semesterTotals, subjects, supportSubjects, type Subject } from './data/curriculum'

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

type ChoiceCourse = {
  id: string
  code: string
  name: string
  credits: number
  category: string
  source: 'manual' | 'imported'
}

type State = {
  schemaVersion: 4
  subjects: Record<string, Status>
  notes: Record<string, number>
  theme: 'dark' | 'light'
  connections: boolean
  mathBasics: RequirementStatus
  literacy: RequirementStatus
  english: RequirementStatus
  schedule: ScheduleSlot[]
  freeChoice: ChoiceCourse[]
}

const totalCredits = curriculumMeta.regularCredits
const semesters = Array.from(new Set(subjects.map((subject) => subject.semester))).sort((a, b) => a - b)
const scheduleDays: ScheduleDay[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

const defaultState: State = {
  schemaVersion: 4,
  subjects: {},
  notes: {},
  theme: 'dark',
  connections: true,
  mathBasics: 'cumplida',
  literacy: 'no-aplica',
  english: 'exento',
  schedule: [],
  freeChoice: [],
}

const STATE_KEY = 'mallatronica-state-v2'

let state = loadState()
let activeView: View = 'malla'
let activeMenu: string | null = null
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
      schemaVersion: 3,
      ...parsed,
      subjects: parsed.subjects ?? {},
      notes: parsed.notes ?? {},
      schedule: Array.isArray(parsed.schedule) ? parsed.schedule.filter(isScheduleSlot) : [],
      freeChoice: Array.isArray(parsed.freeChoice) ? parsed.freeChoice.filter(isChoiceCourse) : [],
    }
  } catch {
    return { ...defaultState, subjects: {}, notes: {}, schedule: [], freeChoice: [] }
  }
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

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

function isApproved(subject: Subject) {
  return state.notes[subject.id] !== undefined
    ? state.notes[subject.id] >= 3
    : state.subjects[subject.id] === 'aprobada'
}

function getApprovedCredits() {
  return subjects.reduce((sum, subject) => sum + (isApproved(subject) ? subject.credits : 0), 0)
}

function getApprovedDisciplinaryCredits() {
  return subjects.reduce((sum, subject) => sum + (disciplinaryIds.has(subject.id) && isApproved(subject) ? subject.credits : 0), 0)
}

function getMissingRequirements(subject: Subject) {
  const missing = subject.prereqs
    .filter((id) => getStatus(subjects.find((item) => item.id === id)!) !== 'aprobada')
    .map((id) => subjects.find((item) => item.id === id)?.name ?? id)

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
  if (support.prereqs.every((prereq) => supportStatus(prereq) === 'aprobada')) return 'disponible'
  return 'bloqueada'
}

function icon(name: string) {
  const icons: Record<string, string> = {
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    calculator: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M7 6.5h10M7.5 11h.01M12 11h.01M16.5 11h.01M7.5 15h.01M12 15h.01M16.5 15h.01M7.5 19h.01M12 19h.01M16.5 19h.01"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18M7 13h.01M12 13h.01M17 13h.01M7 17h.01M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.5h.01"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V9M7 12l5-5 5 5M4 3h16"/></svg>',
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
  const total = subject.prereqs.length + (subject.globalPrereqs?.length ?? 0) + (subject.id === 'calculo-diferencial' && state.mathBasics === 'pendiente' ? 1 : 0)
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
  const approvedCredits = calculateApprovedCredits()
  const percentage = Math.round((approvedCredits / totalCredits) * 100)
  document.documentElement.dataset.theme = state.theme
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand-lockup">
          <div class="brand-mark"><span></span><span></span><span></span></div>
          <div><div class="brand-name">mallatrónica</div><div class="brand-meta">UNAL · BOGOTÁ</div></div>
        </div>
        <div class="sidebar-divider"></div>
        <div class="rail-label">Espacio de trabajo</div>
        <nav class="nav-list" aria-label="Secciones principales">
          ${navItem('malla', icon('grid'), 'Malla curricular', '01')}
          ${navItem('calculadora', icon('calculator'), 'Calculadora PAPA', '02')}
          ${navItem('horario', icon('calendar'), 'Horario semanal', '03')}
          ${navItem('info', icon('info'), 'Info y enlaces', '04')}
        </nav>
        <div class="sidebar-foot">
          <div class="sync-dot"><span></span> Guardado localmente</div>
          <p>Tu avance vive en este navegador. Exportalo para llevarlo con vos.</p>
          <div class="foot-rule"></div>
          <small>v0.2 · Plan ${curriculumMeta.plan}</small>
        </div>
      </aside>
      <main class="main-content">
        <header class="topbar">
          <div class="breadcrumb"><span>Mi carrera</span><span class="slash">/</span><strong>${activeView === 'malla' ? 'Malla curricular' : activeView === 'calculadora' ? 'Calculadora histórica' : activeView === 'horario' ? 'Horario semanal' : 'Información'}</strong></div>
          <div class="top-actions">
            <button class="icon-button" data-action="theme" title="Cambiar tema">${icon('sun')}<span class="hide-mobile">${state.theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span></button>
            <button class="button button-quiet" data-action="export">${icon('download')}<span class="hide-mobile">Exportar avance</span></button>
            <button class="avatar" aria-label="Perfil local">SV</button>
          </div>
        </header>
        ${activeView === 'malla' ? renderMalla(approvedCredits, percentage) : activeView === 'calculadora' ? renderCalculator() : activeView === 'horario' ? renderSchedule() : renderInfo()}
      </main>
    </div>
    <input type="file" id="import-file" accept="application/json" hidden />
  `
  bindEvents()
  requestAnimationFrame(drawConnections)
}

function navItem(view: View, svg: string, label: string, number: string) {
  return `<button class="nav-item ${activeView === view ? 'active' : ''}" data-view="${view}"><span class="nav-icon">${svg}</span><span>${label}</span><small>${number}</small></button>`
}

function renderMalla(approvedCredits: number, percentage: number) {
  return `
    <section class="page-heading">
      <div>
        <div class="eyebrow"><span class="eyebrow-dot"></span> Plan ${curriculumMeta.plan} · referencia 2023</div>
        <h1>Entendé tu <em>ruta.</em></h1>
        <p class="lede">Una lectura clara de tus cursos, prerrequisitos y créditos. Tu avance se guarda solo en este dispositivo.</p>
      </div>
      <div class="heading-note"><span>FUENTE</span><strong>${curriculumMeta.program}</strong><small>${curriculumMeta.campus} · ${curriculumMeta.sourceLabel}</small></div>
    </section>
    <section class="progress-panel">
      <div class="progress-main">
        <div class="progress-value">${percentage}<span>%</span></div>
        <div><div class="progress-title">Créditos regulares aprobados</div><div class="progress-subtitle"><strong>${approvedCredits}</strong> de ${totalCredits} · disciplinares: ${getApprovedDisciplinaryCredits()} / ${curriculumMeta.disciplinaryCredits}</div></div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width: ${Math.max(percentage, 1)}%"><i></i></div><div class="track-mark mark-25"></div><div class="track-mark mark-50"></div><div class="track-mark mark-75"></div></div>
      <div class="progress-foot"><span>Inicio</span><span>Mitad de carrera</span><span>Grado</span></div>
      <div class="progress-actions"><button class="button button-outline" data-action="reset">Reiniciar estado</button><button class="button button-solid" data-view="calculadora">Abrir calculadora ${icon('arrow')}</button></div>
    </section>
    <section class="toolbar">
      <div class="legend"><span class="toolbar-label">Lectura del mapa</span>${legendItem('available', 'Disponible')}${legendItem('partial', 'Parcial')}${legendItem('blocked', 'Bloqueada')}${legendItem('pending', 'Pendiente')}${legendItem('approved', 'Aprobada')}</div>
      <div class="toolbar-controls"><button class="toggle ${state.connections ? 'on' : ''}" data-action="connections"><span></span> Conexiones ${state.connections ? 'ON' : 'OFF'}</button><button class="text-button" data-action="import">${icon('upload')} Importar</button></div>
    </section>
    <section class="map-wrap">
      <div class="map-caption"><span><strong>MALLA CURRICULAR</strong> · ${subjects.length} espacios académicos</span><span class="map-help">Clic: aprobar · <b>⋮</b>: opciones</span></div>
      <div class="curriculum-map">
        <div class="track-labels"><div class="track-header">Componente</div><div class="track-segment foundation">Fundamentación</div><div class="track-segment professional">Formación profesional</div><div class="track-segment elective">Libre elección</div></div>
        <div class="semester-board">${state.connections ? connectionSvg() : ''}${semesters.map((semester) => renderSemester(semester)).join('')}</div>
      </div>
    </section>
    ${renderSupportTracks()}
    <div class="privacy-strip"><span class="privacy-icon">${icon('zap')}</span><span><strong>Datos bajo tu control.</strong> La malla es una referencia del Plan 2545. Contrastá prerrequisitos, homologaciones y vigencia con el SIA.</span><button data-view="info">Ver alcance ${icon('arrow')}</button></div>
  `
}

function renderSupportTracks() {
  const profileSelect = (key: 'mathBasics' | 'literacy' | 'english', label: string) => {
    const value = state[key]
    const options = key === 'english'
      ? `<option value="exento" ${value === 'exento' ? 'selected' : ''}>Exento por examen</option><option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>Debo cursarlo</option>`
      : `<option value="cumplida" ${value === 'cumplida' ? 'selected' : ''}>Ya cumplida</option><option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>Debo cursarla</option><option value="no-aplica" ${value === 'no-aplica' ? 'selected' : ''}>No aplica</option>`
    return `<label class="profile-select"><span>${label}</span><select data-profile="${key}" aria-label="Estado de ${label}">${options}</select></label>`
  }
  const track = (kind: 'nivelacion' | 'idioma', title: string, description: string) => {
    const rows = supportSubjects.filter((subject) => subject.kind === kind).map((subject) => {
      const status = supportStatus(subject.id)
      const info = status === 'exento'
        ? { label: 'Exento', icon: '—', className: 'exempt' }
        : statusInfo(status === 'disponible' ? 'disponible' : status)
      const interactive = kind === 'idioma' && state.english === 'pendiente'
      const row = `<div><strong>${subject.name}</strong><small>${subject.code} · ${subject.credits} créditos</small></div><span class="support-status ${info.className}">${info.icon} ${info.label}</span>`
      return interactive ? `<button type="button" class="support-row support-row-button" data-support-id="${subject.id}">${row}</button>` : `<div class="support-row">${row}</div>`
    }).join('')
    const selectors = kind === 'idioma'
      ? profileSelect('english', 'Lengua extranjera')
      : `<div class="profile-selects">${profileSelect('mathBasics', 'Matemáticas básicas')}${profileSelect('literacy', 'Lecto-escritura')}</div>`
    return `<article class="support-card"><div class="support-head"><div><span class="panel-kicker">Ruta adicional</span><h2>${title}</h2></div>${selectors}</div><p>${description}</p><div class="support-list">${rows}</div></article>`
  }
  return `<section class="support-tracks"><div class="support-intro"><span class="panel-kicker">Fuera de los 172 créditos regulares</span><h2>Tu situación también importa.</h2><p>Estas rutas dependen de tu historia académica. No las tratamos como si fueran iguales para todas las personas.</p></div><div class="support-grid">${track('nivelacion', 'Nivelación', 'Matemáticas básicas y lecto-escritura se registran aparte del plan regular.')}${track('idioma', 'Lengua extranjera', 'Si aprobaste el examen de clasificación, tu cadena de inglés queda exenta.')}</div></section>`
}

function legendItem(className: string, label: string) {
  return `<span class="legend-item"><i class="legend-dot ${className}"></i>${label}</span>`
}

function renderSemester(semester: number) {
  const semesterSubjects = subjects.filter((subject) => subject.semester === semester)
  return `<div class="semester-column"><div class="semester-title"><span>${String(semester).padStart(2, '0')}</span><strong>Semestre ${semester}</strong></div><div class="subject-stack">${semesterSubjects.map(renderSubject).join('')}</div><div class="semester-total">${semesterSubjects.reduce((sum, subject) => sum + subject.credits, 0)} créditos <small>/ ${semesterTotals[semester - 1]}</small></div></div>`
}

function connectionSvg() {
  return `<svg class="connection-layer" preserveAspectRatio="none" aria-hidden="true"></svg>`
}

function drawConnections() {
  const board = app.querySelector<HTMLElement>('.semester-board')
  const svg = app.querySelector<SVGElement>('.connection-layer')
  if (!board || !svg || !state.connections) return
  const boardRect = board.getBoundingClientRect()
  const width = Math.max(board.scrollWidth, boardRect.width)
  const height = Math.max(board.scrollHeight, boardRect.height)
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const paths = subjects.flatMap((subject) => subject.prereqs.map((prereq) => {
    const from = app.querySelector<HTMLElement>(`[data-subject="${prereq}"]`)
    const to = app.querySelector<HTMLElement>(`[data-subject="${subject.id}"]`)
    if (!from || !to) return ''
    const fromRect = from.getBoundingClientRect()
    const toRect = to.getBoundingClientRect()
    const x1 = fromRect.right - boardRect.left
    const y1 = fromRect.top + fromRect.height / 2 - boardRect.top
    const x2 = toRect.left - boardRect.left
    const y2 = toRect.top + toRect.height / 2 - boardRect.top
    const bend = Math.max(28, (x2 - x1) * 0.45)
    return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + bend).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - bend).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`
  })).filter(Boolean).join('')
  svg.innerHTML = paths
}

function renderSubject(subject: Subject) {
  const status = getStatus(subject)
  const info = statusInfo(status)
  const hasNote = state.notes[subject.id] !== undefined
  const missing = getMissingRequirements(subject)
  const requirementText = missing.length ? `<small class="subject-requirements">Falta: ${missing.slice(0, 2).join(' · ')}${missing.length > 2 ? ` · +${missing.length - 2}` : ''}</small>` : ''
  return `<article class="subject-card ${info.className} ${hasNote ? 'has-note' : ''}" data-subject="${subject.id}" tabindex="0" aria-label="${subject.name}, ${info.label}" title="${missing.length ? `Falta: ${missing.join(', ')}` : 'Sin requisitos pendientes'}">
    <div class="subject-top"><span class="subject-code">${subject.code}</span><button class="kebab" data-menu="${subject.id}" aria-label="Más opciones para ${subject.name}">⋮</button></div>
    <h3>${subject.name}</h3>${requirementText}<div class="subject-bottom"><span class="subject-credits">${subject.credits} cr.</span><span class="status-pill ${info.className}"><i>${info.icon}</i>${info.label}</span></div>
    ${subject.tag ? `<span class="subject-tag">${subject.tag}</span>` : ''}
    ${activeMenu === subject.id ? `<div class="subject-menu"><button data-status="aprobada" data-subject-action="${subject.id}">✓ Marcar aprobada</button><button data-status="pendiente" data-subject-action="${subject.id}">◷ Marcar pendiente</button><button data-status="reprobada" data-subject-action="${subject.id}">× Marcar reprobada</button><button data-status="clear" data-subject-action="${subject.id}">↺ Limpiar marca</button></div>` : ''}
  </article>`
}

function renderCalculator() {
  const entries = Object.entries(state.notes)
  const regularEntries = entries.filter(([id]) => subjects.some((item) => item.id === id))
  const levelingEntries = entries.filter(([id]) => supportSubjects.some((item) => item.id === id && item.kind === 'nivelacion'))
  const weighted = regularEntries.reduce((sum, [id, note]) => sum + note * (subjects.find((item) => item.id === id)?.credits ?? 0), 0)
  const credits = regularEntries.reduce((sum, [id]) => sum + (subjects.find((item) => item.id === id)?.credits ?? 0), 0)
  const papa = credits ? (weighted / credits).toFixed(2) : '0.00'
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Historial académico</div><h1>Que tus notas <em>cuenten.</em></h1><p class="lede">Registrá las calificaciones por materia y dejá que la ruta se actualice sola.</p></div><div class="heading-note"><span>REGLA DE CÁLCULO</span><strong>Σ (nota × créditos) / Σ créditos</strong><small>Escala de 0.0 a 5.0 · aprobación desde 3.0</small></div></section>
  <section class="metric-grid"><div class="metric-card accent"><span>PAPA acumulado</span><strong>${papa}</strong><small>Sobre ${credits} créditos regulares con nota</small></div><div class="metric-card"><span>Créditos cursados</span><strong>${credits}</strong><small>Registrados en tu historia</small></div><div class="metric-card"><span>Materias calificadas</span><strong>${regularEntries.length}</strong><small>Podés editar desde la malla</small></div></section>
  <section class="calculator-layout"><div class="panel"><div class="panel-heading"><div><span class="panel-kicker">Historial</span><h2>Notas por semestre</h2></div><button class="button button-solid" data-action="add-semester">+ Añadir semestre</button></div>${renderLevelingSemester(levelingEntries.length > 0)}${semesters.map((semester) => renderGradeSemester(semester)).join('')}</div><aside class="side-note"><span class="side-note-icon">${icon('zap')}</span><h3>La calculadora manda.</h3><p>Cuando una materia tiene nota, su estado se deriva de ella y el marcado manual queda pausado. Las notas de nivelación se guardan aparte hasta confirmar su tratamiento oficial en el PAPA.</p><button class="text-button" data-view="malla">Volver a la malla ${icon('arrow')}</button></aside></section>`
}

function renderLevelingSemester(hasAny: boolean) {
  const levelingSubjects = supportSubjects.filter((subject) => subject.kind === 'nivelacion')
  return `<div class="grade-semester leveling-semester"><div class="grade-semester-title"><span>00</span><strong>Nivelación</strong><small>${hasAny ? 'En progreso' : 'Sin registrar'}</small></div><p class="leveling-note">Semestre 0 · Matemáticas básicas y lecto-escritura se registran aparte de los créditos regulares. Su efecto en el PAPA debe confirmarse con el SIA.</p><div class="grade-rows">${levelingSubjects.map((subject) => `<label class="grade-row"><span>${subject.name}<small>${subject.credits} créditos · ${subject.code}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`).join('')}</div></div>`
}

function renderGradeSemester(semester: number) {
  const semesterSubjects = subjects.filter((subject) => subject.semester === semester)
  const hasAny = semesterSubjects.some((subject) => state.notes[subject.id] !== undefined)
  return `<div class="grade-semester"><div class="grade-semester-title"><span>0${semester}</span><strong>Semestre ${semester}</strong><small>${hasAny ? 'En progreso' : 'Sin registrar'}</small></div><div class="grade-rows">${semesterSubjects.map((subject) => `<label class="grade-row"><span>${subject.name}<small>${subject.credits} créditos · ${subject.code}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`).join('')}</div></div>`
}

function renderSchedule() {
  const slotCount = state.schedule.length
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Planeación semanal</div><h1>Armá tu <em>semana.</em></h1><p class="lede">Agregá tus bloques manualmente y detectá choques antes de armar la matrícula.</p></div><div class="heading-note"><span>FUENTE</span><strong>Carga manual</strong><small>Los grupos del SIA todavía no están conectados</small></div></section>
  <section class="schedule-toolbar"><div><span class="panel-kicker">Tu horario</span><h2>${slotCount ? `${slotCount} bloque${slotCount === 1 ? '' : 's'} guardado${slotCount === 1 ? '' : 's'}` : 'Todavía no hay bloques'}</h2></div><div class="toolbar-controls"><button class="button button-outline" data-action="copy-schedule" ${slotCount ? '' : 'disabled'}>${icon('download')} Copiar</button><button class="button button-solid" data-action="print-schedule">Imprimir</button><button class="text-button" data-action="clear-schedule" ${slotCount ? '' : 'disabled'}>Vaciar</button></div></section>
  <section class="schedule-workspace"><form class="schedule-form" data-schedule-form><div class="schedule-form-head"><span class="panel-kicker">Agregar bloque</span><p>Solo guardamos estos datos en tu navegador.</p></div><label><span>Materia</span><select name="subjectId" required>${subjects.map((subject) => `<option value="${subject.id}">${subject.name} · ${subject.code}</option>`).join('')}</select></label><div class="schedule-form-grid"><label><span>Día</span><select name="day">${scheduleDays.map((day) => `<option value="${day}">${day}</option>`).join('')}</select></label><label><span>Grupo</span><input name="group" maxlength="20" placeholder="Opcional" /></label><label><span>Inicio</span><input name="start" type="time" value="07:00" required /></label><label><span>Fin</span><input name="end" type="time" value="09:00" required /></label><label><span>Salón</span><input name="room" maxlength="30" placeholder="Opcional" /></label></div><button class="button button-solid" type="submit">Agregar al horario ${icon('arrow')}</button></form><aside class="schedule-note"><span class="side-note-icon">${icon('zap')}</span><h3>Primero una versión verificable.</h3><p>No inventamos grupos, profesores ni cupos. Cuando tengamos una fuente SIA confirmada, esta misma vista podrá importar la oferta oficial.</p></aside></section>
  <div class="week-grid"><div class="time-axis"><span>07:00</span><span>09:00</span><span>11:00</span><span>13:00</span><span>15:00</span><span>17:00</span></div>${scheduleDays.map((day) => `<div class="day-column"><strong>${day}</strong><div class="day-lines">${state.schedule.filter((slot) => slot.day === day).sort((a, b) => a.start.localeCompare(b.start)).map(renderScheduleSlot).join('') || '<span class="day-empty">Sin bloques</span>'}</div></div>`).join('')}</div>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}

function renderScheduleSlot(slot: ScheduleSlot) {
  const subject = subjects.find((item) => item.id === slot.subjectId)
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
      const subject = subjects.find((item) => item.id === slot.subjectId)
      const details = [slot.group && `grupo ${slot.group}`, slot.room && slot.room].filter(Boolean).join(' · ')
      return `  ${slot.start}-${slot.end} · ${subject?.name ?? 'Materia'}${details ? ` · ${details}` : ''}`
    }).join('\n')}`
  }).join('\n')
}

function renderInfo() {
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Centro de ayuda</div><h1>Lo importante, <em>a mano.</em></h1><p class="lede">Fuentes oficiales, alcance del plan y configuración de tu ruta personal.</p></div><div class="heading-note"><span>FUENTE</span><strong>Plan ${curriculumMeta.plan}</strong><small>Malla encontrada en 2023 · validar vigencia</small></div></section><section class="info-grid"><article class="info-card wide"><div class="info-card-head"><span class="info-index">01</span><h2>Fuentes y alcance</h2></div><p>Mallatrónica es una herramienta independiente. No reemplaza el SIA ni la asesoría de la coordinación curricular.</p><div class="source-row"><span class="source-dot"></span><span>Malla curricular Plan ${curriculumMeta.plan}.</span><span class="source-status">Referencia 2023</span></div><div class="source-row"><span class="source-dot"></span><span>Tu avance y tu ruta se quedan en este navegador.</span><span class="source-status verified">Privacidad local</span></div><div class="source-row"><span class="source-dot"></span><span>Prerrequisitos visuales interpretados desde la malla.</span><span class="source-status">Validar con SIA</span></div></article><article class="info-card"><div class="info-card-head"><span class="info-index">02</span><h2>Enlaces oficiales</h2></div><div class="link-list"><a href="https://unal.edu.co" target="_blank" rel="noreferrer">Universidad Nacional de Colombia ${icon('arrow')}</a><a href="https://ingenieria.bogota.unal.edu.co" target="_blank" rel="noreferrer">Facultad de Ingeniería ${icon('arrow')}</a><a href="#" data-action="placeholder-link">Calendario académico ${icon('arrow')}</a><a href="#" data-action="placeholder-link">SIA · Sistema académico ${icon('arrow')}</a></div></article><article class="info-card"><div class="info-card-head"><span class="info-index">03</span><h2>Tu ruta personal</h2></div><p class="muted">Configurá nivelación y lengua extranjera desde la malla. En tu caso actual quedan como Matemáticas básicas cumplida e Inglés exento.</p><button class="button button-outline full-width" data-view="malla">Editar en la malla ${icon('arrow')}</button></article></section><div class="legal-note"><span>Nota de confianza</span><p>Los datos académicos, créditos, horarios y requisitos deben contrastarse con los canales oficiales vigentes. La malla 2023 es la mejor referencia disponible, no una confirmación de vigencia para 2026.</p></div>`
}

function bindEvents() {
  app.querySelectorAll<HTMLElement>('[data-view]').forEach((element) => element.addEventListener('click', () => {
    activeView = element.dataset.view as View
    activeMenu = null
    render()
  }))
  app.querySelector<HTMLElement>('[data-action="theme"]')?.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; saveState(); render() })
  app.querySelector<HTMLElement>('[data-action="connections"]')?.addEventListener('click', () => { state.connections = !state.connections; saveState(); render() })
  app.querySelector<HTMLElement>('[data-action="reset"]')?.addEventListener('click', () => {
    if (window.confirm('¿Reiniciar todas las marcas manuales y notas?')) { state.subjects = {}; state.notes = {}; saveState(); render() }
  })
  app.querySelector<HTMLElement>('[data-action="export"]')?.addEventListener('click', exportState)
  app.querySelector<HTMLElement>('[data-action="import"]')?.addEventListener('click', () => app.querySelector<HTMLInputElement>('#import-file')?.click())
  app.querySelector<HTMLInputElement>('#import-file')?.addEventListener('change', importState)
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
  app.querySelectorAll<HTMLElement>('[data-menu]').forEach((element) => element.addEventListener('click', (event) => { event.stopPropagation(); activeMenu = activeMenu === element.dataset.menu ? null : element.dataset.menu ?? null; render() }))
  app.querySelectorAll<HTMLElement>('[data-subject-action]').forEach((element) => element.addEventListener('click', (event) => {
    event.stopPropagation()
    const id = element.dataset.subjectAction!
    const status = element.dataset.status!
    if (status === 'clear') delete state.subjects[id]
    else if (status === 'aprobada' && !canApprove(subjects.find((subject) => subject.id === id)!)) showRequirementToast(subjects.find((subject) => subject.id === id)!)
    else state.subjects[id] = status as Status
    activeMenu = null
    saveState(); render()
  }))
  app.querySelectorAll<HTMLElement>('[data-subject]').forEach((element) => element.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-menu], [data-subject-action]')) return
    const id = element.dataset.subject!
    if (state.notes[id] !== undefined) return
    const subject = subjects.find((item) => item.id === id)!
    if (state.subjects[id] !== 'aprobada' && !canApprove(subject)) { showRequirementToast(subject); return }
    state.subjects[id] = state.subjects[id] === 'aprobada' ? 'pendiente' : 'aprobada'
    saveState(); render()
  }))
  app.querySelectorAll<HTMLInputElement>('[data-note]').forEach((input) => input.addEventListener('change', () => {
    const id = input.dataset.note!
    const value = input.value === '' ? undefined : Number(input.value)
    if (value === undefined || Number.isNaN(value)) delete state.notes[id]
    else state.notes[id] = Math.min(5, Math.max(0, value))
    saveState(); render()
  }))
  app.querySelectorAll<HTMLSelectElement>('[data-profile]').forEach((select) => select.addEventListener('change', () => {
    const key = select.dataset.profile as 'mathBasics' | 'literacy' | 'english'
    state[key] = select.value as RequirementStatus
    saveState(); render()
  }))
  app.querySelectorAll<HTMLButtonElement>('[data-support-id]').forEach((button) => button.addEventListener('click', () => {
    const support = supportSubjects.find((subject) => subject.id === button.dataset.supportId)
    if (!support) return
    const missing = support.prereqs.filter((id) => supportStatus(id) !== 'aprobada')
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
      state = { ...defaultState, ...imported, subjects: imported.subjects, notes: imported.notes ?? {} }
      saveState(); render(); window.alert('Avance importado correctamente.')
    } catch { window.alert('Ese archivo no tiene un formato de avance válido.') }
    input.value = ''
  }
  reader.readAsText(file)
}

render()
