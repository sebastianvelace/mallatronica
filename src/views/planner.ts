import { planItems, planSuggestions, plannedCredits, unlockedByPlan, type PlanItem, type PlanSuggestion } from '../domain/planner'
import { offerFor, offerLoaded, offerSummary } from '../data/sia-offer'
import { buildTimetables, type TimetableCourse, type TimetableOption, type TimetableResult } from '../domain/timetable'
import type { ScheduleDay, ScheduleSlot } from '../domain/state'
import { isFreeChoiceApproved } from '../app/selectors'
import { commit, navigate, store } from '../app/store'
import { escapeHtml } from '../ui/html'
import { icon } from '../ui/icons'
import { showToast } from '../ui/toast'

const visibleSuggestions = 8

// Proposals are ephemeral: recomputed on request, dropped when the plan changes.
let proposals: { key: string; result: TimetableResult } | null = null
let requireSeats = true

function planKey() {
  return `${store.state.plan.join(',')}|${requireSeats}|${store.state.schedule.map((slot) => slot.id).join(',')}`
}

/** Planned plan courses that still have to be taken, with their SIA groups. */
function timetableCourses(): { courses: TimetableCourse[]; withoutGroups: string[] } {
  const state = store.state
  const courses: TimetableCourse[] = []
  const withoutGroups: string[] = []
  for (const item of planItems(state, state.plan)) {
    if (item.kind !== 'plan' || item.state === 'approved') continue
    const offer = offerFor(item.code)
    if (!offer?.groups.length) { withoutGroups.push(item.name); continue }
    courses.push({ id: item.id, name: item.name, groups: offer.groups })
  }
  return { courses, withoutGroups }
}

const shortDay = (day: string) => day.slice(0, 3)
const hours = (minutes: number) => minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

function optionCard(option: TimetableOption, index: number) {
  const picks = option.picks
    .slice()
    .sort((a, b) => a.courseName.localeCompare(b.courseName))
    .map((pick) => `<li><strong>${escapeHtml(pick.courseName)}</strong> · ${escapeHtml(pick.group.activity.replace(/^CLASE /, '').split('-')[0].toLowerCase())} G${escapeHtml(pick.group.group)}<small>${pick.group.sessions.map((session) => `${shortDay(session.day)} ${session.start}–${session.end}`).join(' · ')} · ${pick.group.seats} cupo${pick.group.seats === 1 ? '' : 's'}</small></li>`)
    .join('')
  return `<article class="timetable-option"><header><strong>Opción ${index + 1}</strong><span>${option.days} día${option.days === 1 ? '' : 's'} · ${option.gapMinutes ? `${hours(option.gapMinutes)} de huecos` : 'sin huecos'} · termina ${clock(option.latestEnd)}</span></header><ul>${picks}</ul><button class="button button-solid" type="button" data-timetable-apply="${index}">Usar esta opción ${icon('arrow')}</button></article>`
}

function renderTimetables() {
  if (!offerLoaded()) return ''
  const { courses, withoutGroups } = timetableCourses()
  if (!courses.length) return ''
  const current = proposals?.key === planKey() ? proposals.result : null
  const notes = withoutGroups.length ? `<p class="muted">Sin grupos en el SIA, no se incluyen: ${withoutGroups.map(escapeHtml).join(', ')}.</p>` : ''
  const body = !current
    ? ''
    : current.missing.length
      ? `<p class="timetable-empty">No hay grupos posibles para ${current.missing.map((item) => `${escapeHtml(item.courseName)} (${escapeHtml(item.activity.replace(/^CLASE /, '').toLowerCase())})`).join(', ')}${requireSeats ? ': revisa si quedan cupos o desmarca "solo con cupos"' : ''}.</p>`
      : current.options.length
        ? `<div class="timetable-options">${current.options.map(optionCard).join('')}</div>${current.truncated ? '<p class="muted">Hay muchas combinaciones; se muestran las mejores encontradas.</p>' : ''}`
        : '<p class="timetable-empty">Todas las combinaciones chocan entre sí o con los bloques que ya tienes en el horario.</p>'
  return `<section class="timetable-builder" aria-labelledby="timetable-title"><div class="timetable-head"><div><span class="panel-kicker">Grupos del SIA</span><h3 id="timetable-title">Arma tu horario</h3><p class="muted">Una opción por materia y actividad, sin choques con tu horario actual. Primero las de menos días y menos huecos.</p></div><div class="timetable-controls"><label class="check"><input type="checkbox" data-timetable-seats${requireSeats ? ' checked' : ''} /> Solo grupos con cupos</label><button class="button button-outline" type="button" data-timetable-build>${current ? 'Recalcular' : 'Proponer horarios'}</button></div></div>${notes}${body}</section>`
}

function applyOption(option: TimetableOption) {
  const state = store.state
  const ids = new Set(option.picks.map((pick) => pick.courseId))
  const stamp = Date.now()
  const slots: ScheduleSlot[] = option.picks.flatMap((pick, p) => pick.group.sessions.map((session, s) => ({
    id: `${stamp}-${p}-${s}`,
    subjectId: pick.courseId,
    day: session.day as ScheduleDay,
    start: session.start,
    end: session.end,
    group: `${pick.group.group} · ${pick.group.activity.replace(/^CLASE /, '').split('-')[0].toLowerCase()}`.slice(0, 20),
    room: session.place.slice(0, 30),
  })))
  // Blocks of these courses are replaced; everything else stays.
  state.schedule = [...state.schedule.filter((slot) => !ids.has(slot.subjectId)), ...slots]
  proposals = null
  store.pendingScheduleSubjectId = null
  store.editingSlotId = null
  commit()
  navigate('horario')
  showToast('Horario armado', `${option.picks.length} grupos agregados. Confirma cupos e inscribe en el SIA.`)
}

export function togglePlanned(id: string) {
  const state = store.state
  state.plan = state.plan.includes(id) ? state.plan.filter((item) => item !== id) : [...state.plan, id]
}

function semesterLabel(semester: number | null) {
  return semester === null ? 'sin semestre sugerido' : `semestre sugerido ${semester}`
}

function suggestionRow({ subject, opens, semester }: PlanSuggestion) {
  return `<li class="plan-row"><div><strong>${escapeHtml(subject.name)}</strong><small>${escapeHtml(subject.code)} · ${subject.credits} cr. · ${semesterLabel(semester)}</small><small class="plan-offer${offerFor(subject.code)?.unscheduled ? ' course-offer' : ''}">SIA: ${offerSummary(offerFor(subject.code))}</small></div><span class="plan-opens" title="Materias a las que abre camino">${opens ? `Abre ${opens}` : 'Cierra ruta'}</span><button class="button button-quiet" type="button" data-plan-add="${escapeHtml(subject.id)}" aria-label="Agregar ${escapeHtml(subject.name)} al plan">Agregar</button></li>`
}

function planRow(item: PlanItem) {
  const note = item.state === 'approved'
    ? '<span class="plan-flag ok">Ya aprobada</span>'
    : item.state === 'blocked'
      ? '<span class="plan-flag warn">Requisitos pendientes</span>'
      : ''
  return `<li class="plan-row${item.state === 'approved' ? ' is-done' : ''}"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)} · ${item.credits} cr.${item.kind === 'free' ? ' · libre elección' : ''}</small>${item.kind === 'plan' ? `<small class="plan-offer${offerFor(item.code)?.unscheduled ? ' course-offer' : ''}">SIA: ${offerSummary(offerFor(item.code))}</small>` : ''}${note}</div><div class="plan-row-actions"><button class="text-button" type="button" data-plan-schedule="${escapeHtml(item.id)}"${item.state === 'approved' ? ' disabled' : ''}>Al horario</button><button class="choice-remove" type="button" data-plan-remove="${escapeHtml(item.id)}" aria-label="Quitar ${escapeHtml(item.name)} del plan">×</button></div></li>`
}

export function renderPlanner() {
  const state = store.state
  const items = planItems(state, state.plan)
  const credits = plannedCredits(items)
  const pending = items.filter((item) => item.state !== 'approved')
  const suggestions = planSuggestions(state, state.plan)
  const unlocked = unlockedByPlan(state, state.plan)
  const freeOptions = state.freeChoice.filter((course) => !state.plan.includes(course.id) && !isFreeChoiceApproved(course))
  const showAll = store.openPanels.has('plan-suggestions')
  const suggestionList = suggestions.length
    ? `<ol class="plan-list">${suggestions.slice(0, showAll ? undefined : visibleSuggestions).map(suggestionRow).join('')}</ol>${suggestions.length > visibleSuggestions ? `<button class="text-button" type="button" data-plan-more>${showAll ? 'Ver menos' : `Ver las ${suggestions.length} disponibles`}</button>` : ''}`
    : `<div class="catalog-empty compact"><h2>No hay materias disponibles</h2><p>${state.mathBasics === 'sin-definir' ? 'Configura tu situación de Matemáticas básicas en la malla para habilitar Cálculo diferencial.' : 'Registra tus materias aprobadas en la malla para ver qué puedes inscribir.'}</p><button class="button button-outline" type="button" data-view="malla">Ir a la malla ${icon('arrow')}</button></div>`
  const planList = items.length
    ? `<ul class="plan-list">${items.map(planRow).join('')}</ul>`
    : '<p class="muted">Agrega materias desde las sugerencias o desde el detalle de una materia en la malla.</p>'
  const freePicker = freeOptions.length
    ? `<form class="plan-free" data-plan-free><label><span>Libre elección de tu catálogo</span><select name="id">${freeOptions.map((course) => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.name)} · ${course.credits} cr.</option>`).join('')}</select></label><button class="button button-quiet" type="submit">Agregar</button></form>`
    : ''
  const unlockedList = !pending.length
    ? ''
    : unlocked.length
      ? `<div class="plan-unlocks"><h3>Si apruebas este plan se habilitan ${unlocked.length} materia${unlocked.length === 1 ? '' : 's'}</h3><ul>${unlocked.map((subject) => `<li>${escapeHtml(subject.name)} <small>${escapeHtml(subject.code)}</small></li>`).join('')}</ul></div>`
      : '<div class="plan-unlocks"><h3>Este plan no habilita materias nuevas</h3><p>Igual puede ser necesario: avanza créditos o cierra componentes.</p></div>'
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Próximo semestre</div><h1>Planea tu <em>inscripción.</em></h1><p class="lede">Elige qué cursar con base en tus requisitos registrados y mira qué se habilita si lo apruebas.</p></div><div class="heading-note"><span>CARGA PLANEADA</span><strong>${credits} crédito${credits === 1 ? '' : 's'} · ${pending.length} materia${pending.length === 1 ? '' : 's'}</strong><small>Verifica tu cupo de créditos y la oferta en el SIA</small></div></section>
  <section class="planner-layout">
    <div class="panel"><div class="panel-heading"><div><span class="panel-kicker">Sugerencias</span><h2>Puedes inscribir</h2></div></div><p class="muted">Materias con requisitos registrados cumplidos, ordenadas por cuántas otras materias abren y luego por semestre sugerido. Es una ayuda, no una regla de la universidad.</p>${suggestionList}</div>
    <div class="panel"><div class="panel-heading"><div><span class="panel-kicker">Tu plan</span><h2>${items.length ? `${items.length} materia${items.length === 1 ? '' : 's'}` : 'Plan vacío'}</h2></div>${items.length ? '<button class="text-button" type="button" data-plan-clear>Vaciar plan</button>' : ''}</div>${planList}${freePicker}${unlockedList}${renderTimetables()}</div>
  </section>`
}

/** Existing blocks of courses outside the proposal stay fixed. */
function fixedBlocks() {
  const ids = new Set(timetableCourses().courses.map((course) => course.id))
  return store.state.schedule.filter((slot) => !ids.has(slot.subjectId))
}

export function bindPlanner(root: HTMLElement) {
  const state = store.state
  root.querySelector<HTMLInputElement>('[data-timetable-seats]')?.addEventListener('change', (event) => {
    requireSeats = (event.target as HTMLInputElement).checked
    if (proposals) proposals = { key: planKey(), result: buildTimetables(timetableCourses().courses, fixedBlocks(), { requireSeats }) }
    commit()
  })
  root.querySelector<HTMLButtonElement>('[data-timetable-build]')?.addEventListener('click', () => {
    proposals = { key: planKey(), result: buildTimetables(timetableCourses().courses, fixedBlocks(), { requireSeats }) }
    commit()
    document.querySelector<HTMLElement>('.timetable-options, .timetable-empty')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' })
  })
  root.querySelectorAll<HTMLButtonElement>('[data-timetable-apply]').forEach((button) => button.addEventListener('click', () => {
    const option = proposals?.result.options[Number(button.dataset.timetableApply)]
    if (option) applyOption(option)
  }))
  root.querySelectorAll<HTMLButtonElement>('[data-plan-add]').forEach((button) => button.addEventListener('click', () => {
    togglePlanned(button.dataset.planAdd!)
    commit()
  }))
  root.querySelectorAll<HTMLButtonElement>('[data-plan-remove]').forEach((button) => button.addEventListener('click', () => {
    state.plan = state.plan.filter((id) => id !== button.dataset.planRemove)
    commit()
  }))
  root.querySelector<HTMLButtonElement>('[data-plan-clear]')?.addEventListener('click', () => {
    if (!window.confirm('¿Quitar todas las materias del plan? Tu avance y tu horario no cambian.')) return
    state.plan = []
    commit()
  })
  root.querySelector<HTMLButtonElement>('[data-plan-more]')?.addEventListener('click', () => {
    if (store.openPanels.has('plan-suggestions')) store.openPanels.delete('plan-suggestions')
    else store.openPanels.add('plan-suggestions')
    commit()
  })
  root.querySelector<HTMLFormElement>('[data-plan-free]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const id = String(new FormData(event.currentTarget as HTMLFormElement).get('id') ?? '')
    if (!state.freeChoice.some((course) => course.id === id) || state.plan.includes(id)) return
    state.plan = [...state.plan, id]
    commit()
  })
  root.querySelectorAll<HTMLButtonElement>('[data-plan-schedule]').forEach((button) => button.addEventListener('click', () => {
    store.pendingScheduleSubjectId = button.dataset.planSchedule!
    store.editingSlotId = null
    navigate('horario')
  }))
}
