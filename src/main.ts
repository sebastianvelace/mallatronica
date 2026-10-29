import './style.css'
import { mountCurriculumBoard, renderCurriculumBoard, type BoardOptions } from './ui/curriculum-board'
import { courseCodeKey, curriculumMeta, rawCourseCount, subjects, supportSubjects, type Subject } from './data/curriculum'
import { referenceSemesterForCode } from './data/reference-layout'
import { mergeCatalogCourses, normalizeCatalogCourse, readCatalogCourses, type CatalogCourse } from './domain/catalog'
import { readElectiveAssignments } from './domain/electives'
import { recordedAverage } from './domain/grades'
import {
  approvedCredits, approvedFreeChoiceCredits, courseStatus, isApproved as isApprovedIn, isFreeChoiceApproved as isFreeChoiceApprovedIn,
  missingRequirements, prerequisiteGroupLabel, prerequisiteGroupSatisfied, recordBalance, type RequirementStatus, type Status,
} from './domain/progress'
import { emptyState, isProgressFile, parseState, pruneFreeChoiceProgress, scheduleDays, type ScheduleDay, type ScheduleSlot, type State, type Theme } from './domain/state'

type View = 'malla' | 'calculadora' | 'horario' | 'libre' | 'info'
type ChoiceCourse = CatalogCourse

const totalCredits = curriculumMeta.regularCredits
const semesters = Array.from({ length: 10 }, (_, index) => index + 1)

const STATE_KEY = 'mallatronica-state-v2'

let state = loadState()
let activeView: View = 'malla'
let disposeBoard = () => {}
let pendingCourseId: string | undefined
let freeChoiceQuery = ''
let freeChoiceCategory = 'all'
let pendingScheduleSubjectId: string | null = null
let storageWarningShown = false
// Disclosure state survives full rerenders so editing a field does not collapse its panel.
const openPanels = new Set<string>()

const app = document.querySelector<HTMLDivElement>('#app')!

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    return raw ? parseState(JSON.parse(raw), systemTheme()) : emptyState(systemTheme())
  } catch {
    return emptyState(systemTheme())
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Private mode or a full quota must not break the current session.
    if (!storageWarningShown) {
      storageWarningShown = true
      queueMicrotask(() => showToast('No se pudo guardar', 'Tu navegador bloqueó el almacenamiento local. Exporta tu avance para no perderlo.'))
    }
  }
}

function isApproved(subject: Subject) {
  return isApprovedIn(state, subject)
}

function isFreeChoiceApproved(course: ChoiceCourse) {
  return isFreeChoiceApprovedIn(state, course)
}

function getMissingRequirements(subject: Subject) {
  return missingRequirements(state, subject)
}

function canApprove(subject: Subject) {
  return getMissingRequirements(subject).length === 0
}

function getStatus(subject: Subject) {
  return courseStatus(state, subject)
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
  if (support.prereqGroups.every((group) => prerequisiteGroupSatisfied(state, group))) return 'disponible'
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

function render() {
  disposeBoard()
  const approved = approvedCredits(state)
  const percentage = Math.round((approved / totalCredits) * 100)
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
        ${activeView === 'malla' ? renderMalla(approved, percentage) : activeView === 'calculadora' ? renderCalculator() : activeView === 'horario' ? renderSchedule() : activeView === 'libre' ? renderFreeChoice() : renderInfo()}
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
    ${renderProfileNotice()}
    ${renderCreditBalance()}
    ${renderCurriculumBoard(boardOptions())}
    <details class="curriculum-support" id="support-tracks" data-panel="support"${openPanels.has('support') ? ' open' : ''}><summary>Nivelación y lengua extranjera <span>Configurar mi situación</span></summary>${renderSupportTracks()}</details>
    <footer class="curriculum-footer"><span>Avance guardado en este navegador · oferta y requisitos finales en el SIA</span><div><button class="text-button" data-action="import">Importar avance</button><button class="text-button" data-view="info">Fuentes y alcance</button><button class="text-button" data-action="reset">Reiniciar</button></div></footer>
  `
}

function pendingProfileItems() {
  return [
    state.mathBasics === 'sin-definir' && 'Matemáticas básicas',
    state.literacy === 'sin-definir' && 'Lectoescritura',
    state.english === 'sin-definir' && 'lengua extranjera',
  ].filter((item): item is string => Boolean(item))
}

/** First-run guidance: an unconfigured situation blocks Cálculo diferencial and its dependents. */
function renderProfileNotice() {
  const pending = pendingProfileItems()
  if (!pending.length) return ''
  const blocksCalculus = state.mathBasics === 'sin-definir'
  return `<section class="profile-notice" aria-labelledby="profile-notice-title"><div><strong id="profile-notice-title">Configura tu situación para empezar</strong><p>Falta indicar ${pending.join(', ')}.${blocksCalculus ? ' Mientras no indiques tu situación en Matemáticas básicas, Cálculo diferencial y las materias que dependen de ella aparecerán bloqueadas.' : ''} La aplicación no asume condiciones personales por defecto.</p></div><button class="button button-solid" type="button" data-action="configure-profile">Configurar ahora ${icon('arrow')}</button></section>`
}

function renderCreditBalance() {
  const balance = recordBalance(state)
  return `<details class="curriculum-support credit-balance" data-panel="balance"${openPanels.has('balance') ? ' open' : ''}><summary>Balance de créditos <span>Requisitos por componente · ${balance.required} créditos</span></summary>
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
      } else {
        state.notes[subject.id] = Math.round((grade + Number.EPSILON) * 10) / 10
        delete state.subjects[subject.id]
      }
      const inconsistent = grade !== undefined && getMissingRequirements(subject).length > 0
      pendingCourseId = subject.id
      saveState(); render()
      if (inconsistent) showToast('Nota guardada como historial', 'La materia tiene requisitos sin registrar. Revisa equivalencias o completa el avance anterior.')
    },
    update: (subject, status) => {
      if (state.notes[subject.id] !== undefined) return
      if (status === 'aprobada' && !canApprove(subject)) { showToast(`${subject.name} sigue bloqueada`, getMissingRequirements(subject).slice(0, 3).join(' · ')); return }
      if (status === 'clear') delete state.subjects[subject.id]
      else state.subjects[subject.id] = status
      const inconsistentDependents = status === 'clear'
        ? subjects.filter((candidate) => isApproved(candidate) && getMissingRequirements(candidate).length > 0)
        : []
      pendingCourseId = subject.id
      saveState()
      render()
      if (inconsistentDependents.length) showToast('Revisa el historial', `${inconsistentDependents.length} materia${inconsistentDependents.length === 1 ? '' : 's'} aprobada${inconsistentDependents.length === 1 ? '' : 's'} quedó con requisitos pendientes.`)
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
      ? `<option value="sin-definir" ${value === 'sin-definir' ? 'selected' : ''}>Configurar situación</option><option value="exento" ${value === 'exento' ? 'selected' : ''}>Acreditado sin nota</option><option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>Debo cursar niveles</option>`
      : `<option value="sin-definir" ${value === 'sin-definir' ? 'selected' : ''}>Configurar situación</option><option value="cumplida" ${value === 'cumplida' ? 'selected' : ''}>La cursé y aprobé</option><option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>Debo cursarla / la reprobé</option><option value="no-aplica" ${value === 'no-aplica' ? 'selected' : ''}>No me fue exigida</option>`
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
    const content = kind === 'idioma' && state.english === 'sin-definir'
      ? `<div class="language-accreditation neutral"><strong>Situación sin configurar</strong><span>Elige si acreditaste el requisito o si debes cursar niveles</span><small>La aplicación no asumirá una condición personal por defecto.</small></div>`
      : kind === 'idioma' && state.english === 'exento'
      ? `<div class="language-accreditation"><strong>12 créditos acreditados</strong><span>Registrados como aprobado, sin calificación numérica</span><small>Cumplen el requisito de idioma, pero no entran al promedio.</small></div>`
      : kind === 'idioma'
        ? `<details class="language-routes"><summary>Elegir únicamente la ruta que aparece en mi historia <span>${subjectsForTrack.length} modalidades del catálogo</span></summary><p>Semestral, virtual, intensiva y suficiencia son alternativas. No debes aprobarlas todas.</p><div class="support-list">${rows}</div></details>`
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
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Historial académico</div><h1>Que tus notas <em>cuenten.</em></h1><p class="lede">Registra las calificaciones por materia y deja que la ruta se actualice sola.</p></div><div class="heading-note"><span>REGLA DE CÁLCULO</span><strong>Σ (nota × créditos) / Σ créditos</strong><small>Escala de 0.0 a 5.0 · aprobación desde 3.0</small></div></section>
  <section class="metric-grid"><div class="metric-card accent"><span>Promedio registrado</span><strong>${papa}</strong><small>Sobre ${credits} créditos con nota numérica</small></div><div class="metric-card"><span>Créditos ponderados</span><strong>${credits}</strong><small>Plan, libre elección y nivelación numérica</small></div><div class="metric-card"><span>Materias calificadas</span><strong>${regularEntries.length + levelingEntries.length + freeChoiceEntries.length}</strong><small>Inglés AP/RE no se pondera</small></div></section>
  <section class="calculator-layout"><div class="panel"><div class="panel-heading"><div><span class="panel-kicker">Historial</span><h2>Notas por materia</h2></div></div>${renderLevelingSemester(levelingEntries.length > 0)}${semesters.map((semester) => renderGradeSemester(semester)).join('')}${subjects.some((subject) => referenceSemesterForCode(subject.code) === null) ? renderGradeSemester(null) : ''}${renderFreeChoiceGrades()}</div><aside class="side-note"><span class="side-note-icon">${icon('zap')}</span><h3>Solo se ponderan números.</h3><p>Matemáticas Básicas y Lectoescritura entran al promedio si tienen nota numérica. Inglés acreditado como AP/RE cumple el requisito, pero no se convierte artificialmente en 3.0 o 5.0.</p><button class="text-button" data-view="malla">Volver a la malla ${icon('arrow')}</button></aside></section>`
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
  const semesterSubjects = subjects.filter((subject) => referenceSemesterForCode(subject.code) === semester)
  const hasAny = semesterSubjects.some((subject) => state.notes[subject.id] !== undefined)
  if (!semesterSubjects.length) return ''
  return `<div class="grade-semester"><div class="grade-semester-title"><span>${semester === null ? 'ALT' : String(semester).padStart(2, '0')}</span><strong>${semester === null ? 'Optativas y alternativas sin semestre sugerido' : `Semestre sugerido ${semester}`}</strong><small>${hasAny ? 'En progreso' : 'Sin registrar'}</small></div><div class="grade-rows">${semesterSubjects.map((subject) => `<label class="grade-row"><span>${subject.name}<small>${subject.credits} créditos · ${subject.code}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`).join('')}</div></div>`
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
      : `<div class="catalog-empty"><h2>No hay coincidencias</h2><p>Prueba con otro nombre, código o componente.</p></div>`
    : `<div class="catalog-empty"><div class="empty-orbit">${icon('book')}</div><h2>Catálogo todavía no importado</h2><p>El SIA ofrece un buscador oficial por asignatura, plan, horario y tipología. Importa aquí un JSON exportado o agrega materias manualmente mientras se conecta esa fuente.</p><button class="button button-solid" data-action="import-catalog">Importar catálogo JSON</button></div>`

  const approvedCredits = approvedFreeChoiceCredits(state)
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Catálogo personal</div><h1>Elige con <em>criterio.</em></h1><p class="lede">Guarda opciones, registra su resultado y pásalas al horario sin confundirlas con una oferta oficial.</p></div><div class="heading-note"><span>LIBRE ELECCIÓN REGISTRADA</span><strong>${Math.min(34, approvedCredits)} / 34 créditos</strong><small>${approvedCredits > 34 ? `${approvedCredits - 34} créditos excedentes · ` : ''}validar en SIA</small></div></section>
  <section class="catalog-toolbar"><form data-choice-search><label><span>Buscar</span><input name="query" value="${escapeHtml(freeChoiceQuery)}" placeholder="Nombre o código" /></label><label><span>Componente</span><select name="category"><option value="all">Todos</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${freeChoiceCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></label><button class="button button-outline" type="submit">Filtrar</button></form><div class="toolbar-controls"><button class="button button-quiet" type="button" data-action="import-catalog">Importar JSON</button></div></section>
  <section class="choice-entry"><form data-choice-form><div><span class="panel-kicker">Agregar opción</span><p>Usa datos que hayas verificado en el SIA.</p></div><label><span>Código</span><input name="code" maxlength="30" placeholder="Ej. 201XXXX" required /></label><label class="choice-name-field"><span>Nombre</span><input name="name" maxlength="100" placeholder="Nombre de la asignatura" required /></label><label><span>Créditos</span><input name="credits" type="number" min="1" max="12" step="1" value="3" required /></label><label><span>Componente</span><input name="category" maxlength="60" placeholder="Ej. 2CLE" required /></label><button class="button button-solid" type="submit">Guardar opción ${icon('arrow')}</button></form></section>
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
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Planeación semanal</div><h1>Arma tu <em>semana.</em></h1><p class="lede">Agrega tus bloques manualmente y detectá choques antes de armar la matrícula.</p></div><div class="heading-note"><span>FUENTE</span><strong>Carga manual</strong><small>Los grupos del SIA todavía no están conectados</small></div></section>
  <section class="schedule-toolbar"><div><span class="panel-kicker">Tu horario</span><h2>${slotCount ? `${slotCount} bloque${slotCount === 1 ? '' : 's'} guardado${slotCount === 1 ? '' : 's'}` : 'Todavía no hay bloques'}</h2></div><div class="toolbar-controls"><button class="button button-outline" data-action="copy-schedule" ${slotCount ? '' : 'disabled'}>${icon('download')} Copiar</button><button class="button button-solid" data-action="print-schedule">Imprimir</button><button class="text-button" data-action="clear-schedule" ${slotCount ? '' : 'disabled'}>Vaciar</button></div></section>
  <section class="schedule-workspace"><form class="schedule-form" data-schedule-form><div class="schedule-form-head"><span class="panel-kicker">Agregar bloque</span><p>Solo guardamos estos datos en tu navegador.</p></div><label><span>Materia</span><select name="subjectId" required>${getScheduleCourses().map((subject) => `<option value="${escapeHtml(subject.id)}" ${pendingScheduleSubjectId === subject.id ? 'selected' : ''}>${escapeHtml(subject.name)} · ${escapeHtml(subject.code)}${'sinProgramar' in subject && subject.sinProgramar ? ' · sin programar 2026-2' : ''}</option>`).join('')}</select></label><div class="schedule-form-grid"><label><span>Día</span><select name="day">${scheduleDays.map((day) => `<option value="${day}">${day}</option>`).join('')}</select></label><label><span>Grupo</span><input name="group" maxlength="20" placeholder="Opcional" /></label><label><span>Inicio</span><input name="start" type="time" min="07:00" max="20:59" value="07:00" required /></label><label><span>Fin</span><input name="end" type="time" min="07:01" max="21:00" value="09:00" required /></label><label><span>Salón</span><input name="room" maxlength="30" placeholder="Opcional" /></label></div><button class="button button-solid" type="submit">Agregar al horario ${icon('arrow')}</button></form><aside class="schedule-note"><span class="side-note-icon">${icon('zap')}</span><h3>Primero una versión verificable.</h3><p>No inventamos grupos, profesores ni cupos. Cuando tengamos una fuente SIA confirmada, esta misma vista podrá importar la oferta oficial.</p></aside></section>
  <div class="week-grid"><div class="time-axis">${['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'].map((time) => `<span>${time}</span>`).join('')}</div>${scheduleDays.map((day) => `<div class="day-column"><strong>${day}</strong><div class="day-lines">${state.schedule.filter((slot) => slot.day === day).sort((a, b) => a.start.localeCompare(b.start)).map(renderScheduleSlot).join('') || '<span class="day-empty">Sin bloques</span>'}</div></div>`).join('')}</div>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}

function renderScheduleSlot(slot: ScheduleSlot) {
  const subject = getScheduleCourse(slot.subjectId)
  const details = [slot.group && `Grupo ${escapeHtml(slot.group)}`, slot.room && escapeHtml(slot.room)].filter(Boolean).join(' · ')
  const start = Math.max(7 * 60, Math.min(21 * 60, timeToMinutes(slot.start)))
  const end = Math.max(start + 15, Math.min(21 * 60, timeToMinutes(slot.end)))
  const top = ((start - 7 * 60) / (14 * 60)) * 100
  const height = ((end - start) / (14 * 60)) * 100
  return `<article class="schedule-block" style="top:${top}%;height:${height}%"><div class="schedule-block-time">${slot.start}–${slot.end}</div><strong>${escapeHtml(subject?.name ?? 'Materia eliminada')}</strong>${details ? `<small>${details}</small>` : ''}<button type="button" data-schedule-remove="${escapeHtml(slot.id)}" aria-label="Quitar ${escapeHtml(subject?.name ?? 'bloque')}">×</button></article>`
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
  const profileConfigured = [state.mathBasics, state.literacy, state.english].filter((value) => value !== 'sin-definir').length
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Centro de ayuda</div><h1>Lo importante, <em>a mano.</em></h1><p class="lede">Fuentes oficiales, alcance del plan y configuración de tu ruta personal.</p></div><div class="heading-note"><span>FUENTE</span><strong>Plan ${curriculumMeta.plan}</strong><small>${curriculumMeta.sourceLabel}</small></div></section><section class="info-grid"><article class="info-card wide"><div class="info-card-head"><span class="info-index">01</span><h2>Fuentes y alcance</h2></div><p>Mallatrónica es una herramienta independiente. No reemplaza el SIA ni la asesoría de la coordinación curricular.</p><div class="source-row"><span class="source-dot"></span><span>Catálogo público SIA · ${rawCourseCount} registros: ${subjects.length} del plan regular y ${supportSubjects.length} de nivelación/lengua.</span><span class="source-status verified">Fuente primaria</span></div><div class="source-row"><span class="source-dot"></span><span>Tu avance y tu ruta se quedan en este navegador.</span><span class="source-status verified">Privacidad local</span></div><div class="source-row"><span class="source-dot"></span><span>Los semestres del mapa son una referencia visual; no vienen publicados en la extracción SIA.</span><span class="source-status">Dato orientativo</span></div></article><article class="info-card"><div class="info-card-head"><span class="info-index">02</span><h2>Enlaces oficiales</h2></div><div class="link-list"><a href="https://unal.edu.co" target="_blank" rel="noreferrer">Universidad Nacional de Colombia ${icon('arrow')}</a><a href="https://ingenieria.bogota.unal.edu.co" target="_blank" rel="noreferrer">Facultad de Ingeniería ${icon('arrow')}</a><a href="https://siabog.unal.edu.co/academia/libre-acceso/faq.do" target="_blank" rel="noreferrer">SIA · preguntas frecuentes ${icon('arrow')}</a><a href="https://siabog.unal.edu.co/academia/libre-acceso/manuales/539019aa08a39d44dc7c45e1a888f821.pdf" target="_blank" rel="noreferrer">Guía oficial del buscador ${icon('arrow')}</a></div></article><article class="info-card"><div class="info-card-head"><span class="info-index">03</span><h2>Tu ruta personal</h2></div><p class="muted">${profileConfigured === 3 ? 'Tu situación de nivelación y lengua extranjera está configurada.' : `Falta configurar ${3 - profileConfigured} de 3 condiciones personales. La aplicación no las presume por ti.`}</p><button class="button button-outline full-width" data-view="malla">Editar en la malla ${icon('arrow')}</button></article></section><div class="legal-note"><span>Nota de confianza</span><p>El catálogo SIA aporta asignaturas y prerrequisitos, pero no publica aquí todos los requisitos de grado, la distribución de libre elección ni los semestres sugeridos. Contrasta siempre la vigencia con el SIA.</p></div>`
}

function bindEvents() {
  app.querySelectorAll<HTMLElement>('[data-view]').forEach((element) => element.addEventListener('click', () => {
    activeView = element.dataset.view as View
    render()
  }))
  app.querySelector<HTMLElement>('[data-action="theme"]')?.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; saveState(); render() })
  app.querySelector<HTMLElement>('[data-action="reset"]')?.addEventListener('click', () => {
    if (window.confirm('¿Borrar todo el avance local, la configuración personal, el catálogo de libre elección y el horario? El tema visual se conservará.')) {
      state = emptyState(state.theme)
      saveState(); render()
    }
  })
  app.querySelectorAll<HTMLDetailsElement>('details[data-panel]').forEach((details) => details.addEventListener('toggle', () => {
    if (details.open) openPanels.add(details.dataset.panel!)
    else openPanels.delete(details.dataset.panel!)
  }))
  app.querySelector<HTMLElement>('[data-action="configure-profile"]')?.addEventListener('click', () => {
    const support = app.querySelector<HTMLDetailsElement>('#support-tracks')
    if (!support) return
    support.open = true
    openPanels.add('support')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    support.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    support.querySelector<HTMLSelectElement>('select[data-profile]')?.focus({ preventScroll: true })
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
        const merged = mergeCatalogCourses(state.freeChoice, imported)
        state.freeChoice = merged.courses
        pruneFreeChoiceProgress(state)
        state.electiveAssignments = readElectiveAssignments(state.electiveAssignments, state.freeChoice)
        saveState()
        render()
        showToast('Catálogo combinado', `${merged.added} opciones agregadas${merged.skipped ? ` · ${merged.skipped} duplicadas conservadas sin cambios` : ''}.`)
      } catch {
        showToast('No se pudo importar', 'Usa un JSON con code/name/credits/category o courseCode/courseName/component.')
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
      showToast('Faltan datos', 'Completa código, nombre, créditos y componente.')
      return
    }
    if (state.freeChoice.some((item) => courseCodeKey(item.code) === courseCodeKey(course.code))) {
      showToast('Código duplicado', 'Ya existe una materia con ese código en tu catálogo local.')
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
      showToast('El bloque no se puede agregar', 'La hora de fin debe ser posterior a la hora de inicio.')
      return
    }
    if (timeToMinutes(candidate.start) < 7 * 60 || timeToMinutes(candidate.end) > 21 * 60) {
      showToast('Horario fuera del tablero', 'Usa horas entre 07:00 y 21:00.')
      return
    }
    if (scheduleHasConflict(candidate)) {
      showToast('Hay un choque de horario', `Ya tienes otro bloque el ${candidate.day} en ese intervalo.`)
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
      showToast('Horario copiado', 'Ya puedes pegarlo en tus notas o compartirlo.')
    } catch {
      showToast('No se pudo copiar', 'Tu navegador bloqueó el portapapeles. Usa Imprimir o copia los bloques manualmente.')
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
    if (value !== undefined && (!input.checkValidity() || !Number.isFinite(value))) {
      input.reportValidity()
      input.value = state.notes[id]?.toFixed(1) ?? ''
      return
    }
    if (value === undefined) {
      delete state.notes[id]
      // Without the grade, the derived situation is unknown again; it must not stay "cumplida".
      if (id === 'matematicas-basicas') state.mathBasics = 'sin-definir'
      if (id === 'lecto-escritura') state.literacy = 'sin-definir'
    } else {
      state.notes[id] = Math.round((value + Number.EPSILON) * 10) / 10
      delete state.subjects[id]
      if (id === 'matematicas-basicas') state.mathBasics = state.notes[id] >= 3 ? 'cumplida' : 'pendiente'
      if (id === 'lecto-escritura') state.literacy = state.notes[id] >= 3 ? 'cumplida' : 'pendiente'
    }
    const subject = subjects.find((item) => item.id === id)
    const inconsistent = value !== undefined && subject !== undefined && getMissingRequirements(subject).length > 0
    saveState(); render()
    if (inconsistent) showToast('Nota guardada como historial', 'La materia tiene requisitos sin registrar. Revisa equivalencias o completa el avance anterior.')
  }))
  app.querySelectorAll<HTMLInputElement>('[data-free-note]').forEach((input) => input.addEventListener('change', () => {
    const id = input.dataset.freeNote!
    if (!state.freeChoice.some(course => course.id === id)) return
    const value = input.value === '' ? undefined : Number(input.value)
    if (value !== undefined && (!input.checkValidity() || !Number.isFinite(value))) {
      input.reportValidity()
      input.value = state.freeChoiceNotes[id]?.toFixed(1) ?? ''
      return
    }
    if (value === undefined) delete state.freeChoiceNotes[id]
    else {
      state.freeChoiceNotes[id] = Math.round((value + Number.EPSILON) * 10) / 10
      delete state.freeChoiceStatus[id]
    }
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
      const contradictsGrade = select.value === 'no-aplica' || select.value === 'sin-definir'
        || (select.value === 'pendiente' && grade >= 3)
        || (select.value === 'cumplida' && grade < 3)
      if (contradictsGrade) {
        delete state.notes[subjectId]
        saveState(); render()
        showToast('Estado actualizado', 'Se quitó la nota anterior porque contradecía la nueva situación seleccionada.')
        return
      }
    }
    saveState(); render()
  }))
  app.querySelectorAll<HTMLButtonElement>('[data-support-id]').forEach((button) => button.addEventListener('click', () => {
    const support = supportSubjects.find((subject) => subject.id === button.dataset.supportId)
    if (!support) return
    const missing = support.prereqGroups?.filter((group) => !prerequisiteGroupSatisfied(state, group)).map(prerequisiteGroupLabel) ?? []
    if (missing.length) { showToast(`${support.name} sigue bloqueado`, `Primero completa ${missing.join(', ')}`); return }
    state.subjects[support.id] = state.subjects[support.id] === 'aprobada' ? 'pendiente' : 'aprobada'
    saveState(); render()
  }))
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

/** One persistent live region, so assistive technology announces every message. */
function showToast(title: string, message: string) {
  let toast = document.querySelector<HTMLDivElement>('.requirement-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'requirement-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    toast.setAttribute('aria-atomic', 'true')
    document.body.appendChild(toast)
  }
  const heading = document.createElement('strong')
  const detail = document.createElement('span')
  heading.textContent = title
  detail.textContent = message
  toast.replaceChildren(heading, detail)
  toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast!.hidden = true }, 4200)
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
    input.value = ''
    let imported: unknown
    try {
      imported = JSON.parse(String(reader.result))
    } catch {
      imported = undefined
    }
    if (!isProgressFile(imported)) {
      showToast('No se pudo importar', 'Ese archivo no tiene un formato de avance válido.')
      return
    }
    if (!window.confirm('¿Reemplazar tu avance actual por el del archivo? Exporta primero una copia si quieres conservarlo.')) return
    state = parseState(imported, state.theme)
    saveState(); render()
    showToast('Avance importado', 'Tu avance se reemplazó con el archivo seleccionado.')
  }
  reader.readAsText(file)
}

render()
