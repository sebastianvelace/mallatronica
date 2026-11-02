import { courseCodeKey } from '../data/curriculum'
import { mergeCatalogCourses, normalizeCatalogCourse, readCatalogCourses, type CatalogCourse } from '../domain/catalog'
import { readElectiveAssignments } from '../domain/electives'
import { approvedFreeChoiceCredits } from '../domain/progress'
import { pruneFreeChoiceProgress } from '../domain/state'
import structure from '../../data/sia/v2/estructura.json'
import { isFreeChoiceApproved } from '../app/selectors'
import { commit, navigate, render, store } from '../app/store'
import { escapeHtml } from '../ui/html'
import { icon } from '../ui/icons'
import { showToast } from '../ui/toast'

const freeChoiceRequired = structure.resumen_creditos.find(row => row.tipologia === 'LIBRE ELECCIÓN')?.exigidos ?? 34
const sourceLabels: Record<CatalogCourse['source'], string> = { manual: 'Manual', imported: 'Importada', 'sia-public': 'SIA' }

export function renderFreeChoice() {
  const state = store.state
  const categories = Array.from(new Set(state.freeChoice.map((course) => course.category))).sort((a, b) => a.localeCompare(b))
  const query = store.freeChoiceQuery.trim().toLocaleLowerCase()
  const visibleCourses = state.freeChoice.filter((course) => {
    const matchesQuery = !query || `${course.name} ${course.code}`.toLocaleLowerCase().includes(query)
    const matchesCategory = store.freeChoiceCategory === 'all' || course.category === store.freeChoiceCategory
    return matchesQuery && matchesCategory
  })
  const catalogContent = state.freeChoice.length
    ? visibleCourses.length
      ? `<div class="choice-grid">${visibleCourses.map(renderFreeChoiceCard).join('')}</div>`
      : `<div class="catalog-empty"><h2>No hay coincidencias</h2><p>Prueba con otro nombre, código o componente.</p></div>`
    : `<div class="catalog-empty"><div class="empty-orbit">${icon('book')}</div><h2>Catálogo todavía no importado</h2><p>El SIA ofrece un buscador oficial por asignatura, plan, horario y tipología. Importa aquí un JSON exportado o agrega materias manualmente mientras se conecta esa fuente.</p><button class="button button-solid" data-action="import-catalog">Importar catálogo JSON</button></div>`

  const approvedCredits = approvedFreeChoiceCredits(state)
  const required = freeChoiceRequired
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Catálogo personal</div><h1>Elige con <em>criterio.</em></h1><p class="lede">Guarda opciones, registra su resultado y pásalas al horario sin confundirlas con una oferta oficial.</p></div><div class="heading-note"><span>LIBRE ELECCIÓN REGISTRADA</span><strong>${Math.min(required, approvedCredits)} / ${required} créditos</strong><small>${approvedCredits > required ? `${approvedCredits - required} créditos excedentes · ` : ''}validar en SIA</small></div></section>
  <section class="catalog-toolbar"><form data-choice-search><label><span>Buscar</span><input name="query" value="${escapeHtml(store.freeChoiceQuery)}" placeholder="Nombre o código" /></label><label><span>Componente</span><select name="category"><option value="all">Todos</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${store.freeChoiceCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></label><button class="button button-outline" type="submit">Filtrar</button></form><div class="toolbar-controls"><button class="button button-quiet" type="button" data-action="import-catalog">Importar JSON</button></div></section>
  <section class="choice-entry"><form data-choice-form><div><span class="panel-kicker">Agregar opción</span><p>Usa datos que hayas verificado en el SIA.</p></div><label><span>Código</span><input name="code" maxlength="30" placeholder="Ej. 201XXXX" required /></label><label class="choice-name-field"><span>Nombre</span><input name="name" maxlength="100" placeholder="Nombre de la asignatura" required /></label><label><span>Créditos</span><input name="credits" type="number" min="1" max="12" step="1" value="3" required /></label><label><span>Componente</span><input name="category" maxlength="60" placeholder="Ej. 2CLE" required /></label><button class="button button-solid" type="submit">Guardar opción ${icon('arrow')}</button></form></section>
  <section class="choice-results"><div class="map-caption"><span><strong>OPCIONES GUARDADAS</strong> · ${visibleCourses.length} visibles</span><span class="map-help">Se guardan solo en este navegador</span></div>${catalogContent}</section>`
}

function renderFreeChoiceCard(course: CatalogCourse) {
  const state = store.state
  const grade = state.freeChoiceNotes[course.id]
  const approved = isFreeChoiceApproved(course)
  const status = grade !== undefined ? (approved ? 'Aprobada' : 'Reprobada') : approved ? 'Aprobada' : 'Pendiente'
  return `<article class="choice-card ${approved ? 'is-approved' : ''}"><div class="choice-card-top"><span class="subject-code">${escapeHtml(course.code)}</span><span class="choice-status">${status}</span></div><h3>${escapeHtml(course.name)}</h3><p>${escapeHtml(course.category)} · ${sourceLabels[course.source]}</p><div class="choice-progress"><label><span>Nota opcional</span><input type="number" min="0" max="5" step="0.1" value="${grade ?? ''}" placeholder="—" data-free-note="${escapeHtml(course.id)}" aria-label="Nota de ${escapeHtml(course.name)}" /></label><button class="button button-quiet" type="button" data-free-approved="${escapeHtml(course.id)}" ${grade !== undefined ? 'disabled' : ''}>${grade !== undefined ? 'Estado por nota' : approved ? 'Quitar aprobación' : 'Marcar aprobada'}</button></div><div class="choice-card-bottom"><span>${course.credits} créditos</span><div><button class="text-button" data-choice-schedule="${escapeHtml(course.id)}">Al horario ${icon('arrow')}</button><button class="choice-remove" type="button" data-choice-remove="${escapeHtml(course.id)}" aria-label="Eliminar ${escapeHtml(course.name)}">×</button></div></div></article>`
}

export function bindFreeChoice(root: HTMLElement) {
  const state = store.state
  root.querySelector<HTMLElement>('[data-action="import-catalog"]')?.addEventListener('click', () => root.querySelector<HTMLInputElement>('#catalog-file')?.click())
  root.querySelector<HTMLInputElement>('#catalog-file')?.addEventListener('change', (event) => {
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
        commit()
        showToast('Catálogo combinado', `${merged.added} opciones agregadas${merged.skipped ? ` · ${merged.skipped} duplicadas conservadas sin cambios` : ''}.`)
      } catch {
        showToast('No se pudo importar', 'Usa un JSON con code/name/credits/category o courseCode/courseName/component.')
      }
      input.value = ''
    }
    reader.readAsText(file)
  })
  root.querySelector<HTMLFormElement>('[data-choice-form]')?.addEventListener('submit', (event) => {
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
    commit()
  })
  root.querySelector<HTMLFormElement>('[data-choice-search]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    store.freeChoiceQuery = String(data.get('query') ?? '')
    store.freeChoiceCategory = String(data.get('category') ?? 'all')
    render()
  })
  root.querySelectorAll<HTMLElement>('[data-choice-schedule]').forEach((element) => element.addEventListener('click', () => {
    store.pendingScheduleSubjectId = element.dataset.choiceSchedule ?? null
    store.editingSlotId = null
    navigate('horario')
  }))
  root.querySelectorAll<HTMLElement>('[data-choice-remove]').forEach((element) => element.addEventListener('click', () => {
    const id = element.dataset.choiceRemove
    const course = state.freeChoice.find((item) => item.id === id)
    if (!id || !course || !window.confirm(`¿Eliminar ${course.name} del catálogo local?`)) return
    state.freeChoice = state.freeChoice.filter((item) => item.id !== id)
    delete state.freeChoiceStatus[id]
    delete state.freeChoiceNotes[id]
    state.electiveAssignments = readElectiveAssignments(state.electiveAssignments, state.freeChoice)
    state.schedule = state.schedule.filter((slot) => slot.subjectId !== id)
    state.plan = state.plan.filter((planned) => planned !== id)
    delete state.attempts[id]
    commit()
  }))
}
