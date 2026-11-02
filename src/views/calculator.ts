import { subjects, supportSubjects } from '../data/curriculum'
import { referenceSemesterForCode } from '../data/reference-layout'
import { recordedAverage } from '../domain/grades'
import { store } from '../app/store'
import { escapeHtml } from '../ui/html'
import { icon } from '../ui/icons'

const semesters = Array.from({ length: 10 }, (_, index) => index + 1)

export function renderCalculator() {
  const state = store.state
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
  const state = store.state
  if (!state.freeChoice.length) return ''
  const hasAny = Object.keys(state.freeChoiceNotes).some(id => state.freeChoice.some(course => course.id === id))
  return `<div class="grade-semester free-choice-semester"><div class="grade-semester-title"><span>LE</span><strong>Libre elección</strong><small>${hasAny ? 'En progreso' : 'Sin registrar'}</small></div><p class="leveling-note">Estas notas sí entran en el promedio registrado. La aplicación limita su aporte al avance a 34 créditos.</p><div class="grade-rows">${state.freeChoice.map(course => `<label class="grade-row"><span>${escapeHtml(course.name)}<small>${course.credits} créditos · ${escapeHtml(course.code)}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.freeChoiceNotes[course.id] ?? ''}" placeholder="—" data-free-note="${escapeHtml(course.id)}" aria-label="Nota de ${escapeHtml(course.name)}" /></label>`).join('')}</div></div>`
}

function renderLevelingSemester(hasAny: boolean) {
  const state = store.state
  const levelingSubjects = supportSubjects.filter((subject) => subject.kind === 'nivelacion')
  return `<div class="grade-semester leveling-semester"><div class="grade-semester-title"><span>00</span><strong>Nivelación con nota numérica</strong><small>${hasAny ? 'Incluida en el promedio' : 'Sin registrar'}</small></div><p class="leveling-note">Matemáticas Básicas y Lectoescritura tienen créditos adicionales: se ponderan en el promedio, pero no suman a los 172 créditos del plan. Inglés AP/RE se gestiona desde la malla y no entra aquí.</p><div class="grade-rows">${levelingSubjects.map((subject) => `<label class="grade-row"><span>${subject.name}<small>${subject.credits} créditos adicionales · ${subject.code}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`).join('')}</div></div>`
}

function renderGradeSemester(semester: number | null) {
  const state = store.state
  const semesterSubjects = subjects.filter((subject) => referenceSemesterForCode(subject.code) === semester)
  const hasAny = semesterSubjects.some((subject) => state.notes[subject.id] !== undefined)
  if (!semesterSubjects.length) return ''
  return `<div class="grade-semester"><div class="grade-semester-title"><span>${semester === null ? 'ALT' : String(semester).padStart(2, '0')}</span><strong>${semester === null ? 'Optativas y alternativas sin semestre sugerido' : `Semestre sugerido ${semester}`}</strong><small>${hasAny ? 'En progreso' : 'Sin registrar'}</small></div><div class="grade-rows">${semesterSubjects.map((subject) => `<label class="grade-row"><span>${subject.name}<small>${subject.credits} créditos · ${subject.code}</small></span><input type="number" min="0" max="5" step="0.1" value="${state.notes[subject.id] ?? ''}" placeholder="—" data-note="${subject.id}" aria-label="Nota de ${subject.name}" /></label>`).join('')}</div></div>`
}
