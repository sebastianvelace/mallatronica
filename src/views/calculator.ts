import { subjects, supportSubjects } from '../data/curriculum'
import { referenceSemesterForCode } from '../data/reference-layout'
import { cumulativeAverage, recordedAverage } from '../domain/grades'
import { commit, store } from '../app/store'
import { escapeHtml } from '../ui/html'
import { icon } from '../ui/icons'
import { showToast } from '../ui/toast'

const semesters = Array.from({ length: 10 }, (_, index) => index + 1)

export function renderCalculator() {
  const state = store.state
  const entries = Object.entries(state.notes)
  const regularEntries = entries.filter(([id]) => subjects.some((item) => item.id === id))
  const levelingEntries = entries.filter(([id]) => supportSubjects.some((item) => item.id === id && item.kind === 'nivelacion'))
  const freeChoiceEntries = Object.entries(state.freeChoiceNotes).filter(([id]) => state.freeChoice.some((item) => item.id === id))
  const average = recordedAverage(state.notes, state.freeChoice, state.freeChoiceNotes)
  const cumulative = cumulativeAverage(state.notes, state.attempts, state.freeChoice, state.freeChoiceNotes)
  const pa = average.value?.toFixed(2) ?? 'Sin notas'
  const papa = cumulative.value?.toFixed(2) ?? 'Sin notas'
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Historial académico</div><h1>Que tus notas <em>cuenten.</em></h1><p class="lede">Registra las calificaciones por materia y deja que la ruta se actualice sola.</p></div><div class="heading-note"><span>REGLA DE CÁLCULO</span><strong>Σ (nota × créditos) / Σ créditos</strong><small>Escala de 0.0 a 5.0 · aprobación desde 3.0</small></div></section>
  <section class="metric-grid"><div class="metric-card accent"><span>PAPA estimado</span><strong>${papa}</strong><small>${cumulative.credits} créditos cursados · ${cumulative.repeated ? `incluye ${cumulative.repeated} intento${cumulative.repeated === 1 ? '' : 's'} anterior${cumulative.repeated === 1 ? '' : 'es'}` : 'sin intentos anteriores'}</small></div><div class="metric-card"><span>PA estimado</span><strong>${pa}</strong><small>Última nota de cada materia · ${average.credits} créditos</small></div><div class="metric-card"><span>Materias calificadas</span><strong>${regularEntries.length + levelingEntries.length + freeChoiceEntries.length}</strong><small>Inglés AP/RE no se pondera</small></div></section>
  <section class="calculator-layout"><div class="panel"><div class="panel-heading"><div><span class="panel-kicker">Historial</span><h2>Notas por materia</h2></div></div>${renderLevelingSemester(levelingEntries.length > 0)}${semesters.map((semester) => renderGradeSemester(semester)).join('')}${subjects.some((subject) => referenceSemesterForCode(subject.code) === null) ? renderGradeSemester(null) : ''}${renderFreeChoiceGrades()}${renderAttempts()}</div><aside class="side-note"><span class="side-note-icon">${icon('zap')}</span><h3>PA y PAPA no son lo mismo.</h3><p>El PA usa la última nota de cada materia; el PAPA suma todos los intentos, incluidas las materias reprobadas que repetiste (Acuerdo 008 de 2008, Art. 41 y 42). Matemáticas Básicas y Lectoescritura entran al promedio si tienen nota numérica. Inglés acreditado como AP/RE cumple el requisito, pero no se convierte artificialmente en 3.0 o 5.0.</p><button class="text-button" data-view="malla">Volver a la malla ${icon('arrow')}</button></aside></section>`
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

/** Courses with a recorded grade can carry earlier failing attempts. */
function gradedCourses() {
  const state = store.state
  const plan = [...supportSubjects.filter((course) => course.kind === 'nivelacion'), ...subjects]
    .filter((course) => state.notes[course.id] !== undefined)
    .map((course) => ({ id: course.id, name: course.name, credits: course.credits }))
  const free = state.freeChoice.filter((course) => state.freeChoiceNotes[course.id] !== undefined)
  return [...plan, ...free.map((course) => ({ id: course.id, name: course.name, credits: course.credits }))]
}

function renderAttempts() {
  const state = store.state
  const courses = gradedCourses()
  const nameFor = (id: string) => courses.find((course) => course.id === id)?.name ?? subjects.find((subject) => subject.id === id)?.name ?? state.freeChoice.find((course) => course.id === id)?.name ?? id
  const rows = Object.entries(state.attempts).flatMap(([id, grades]) => grades.map((grade, index) => `<li class="attempt-row"><span>${escapeHtml(nameFor(id))}<small>Intento anterior ${index + 1}</small></span><strong>${grade.toFixed(1)}</strong><button class="choice-remove" type="button" data-attempt-remove="${escapeHtml(id)}" data-attempt-index="${index}" aria-label="Quitar intento ${index + 1} de ${escapeHtml(nameFor(id))}">×</button></li>`)).join('')
  const form = courses.length
    ? `<form class="attempt-form" data-attempt-form><label><span>Materia</span><select name="id" required>${courses.map((course) => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.name)} · ${course.credits} cr.</option>`).join('')}</select></label><label><span>Nota del intento anterior</span><input name="grade" type="number" min="0" max="2.9" step="0.1" placeholder="0.0 a 2.9" required /></label><button class="button button-quiet" type="submit">Agregar intento</button></form>`
    : '<p class="leveling-note">Registra primero la nota más reciente de la materia; luego agrega aquí sus intentos anteriores.</p>'
  return `<div class="grade-semester attempts-semester"><div class="grade-semester-title"><span>RE</span><strong>Materias repetidas</strong><small>${rows ? 'Incluidas en el PAPA' : 'Sin intentos anteriores'}</small></div><p class="leveling-note">La nota de cada fila es la más reciente y es la que usa el PA. Si repetiste una materia, agrega aquí las notas reprobadas anteriores: el PAPA las suma todas. Cancelaciones sin nota no cuentan.</p>${rows ? `<ul class="attempt-list">${rows}</ul>` : ''}${form}</div>`
}

export function bindCalculator(root: HTMLElement) {
  const state = store.state
  root.querySelector<HTMLFormElement>('[data-attempt-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    if (!form.reportValidity()) return
    const data = new FormData(form)
    const id = String(data.get('id') ?? '')
    const grade = Math.round((Number(data.get('grade')) + Number.EPSILON) * 10) / 10
    if (!gradedCourses().some((course) => course.id === id) || !Number.isFinite(grade) || grade < 0 || grade >= 3) {
      showToast('Intento no válido', 'Un intento anterior debe ser una nota reprobada entre 0.0 y 2.9 de una materia con nota registrada.')
      return
    }
    state.attempts = { ...state.attempts, [id]: [...(state.attempts[id] ?? []), grade] }
    commit()
  })
  root.querySelectorAll<HTMLButtonElement>('[data-attempt-remove]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.attemptRemove!
    const index = Number(button.dataset.attemptIndex)
    const remaining = (state.attempts[id] ?? []).filter((_, position) => position !== index)
    const next = { ...state.attempts }
    if (remaining.length) next[id] = remaining
    else delete next[id]
    state.attempts = next
    commit()
  }))
}
