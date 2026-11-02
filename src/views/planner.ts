import { planItems, planSuggestions, plannedCredits, unlockedByPlan, type PlanItem, type PlanSuggestion } from '../domain/planner'
import { isFreeChoiceApproved } from '../app/selectors'
import { commit, navigate, store } from '../app/store'
import { escapeHtml } from '../ui/html'
import { icon } from '../ui/icons'

const visibleSuggestions = 8

export function togglePlanned(id: string) {
  const state = store.state
  state.plan = state.plan.includes(id) ? state.plan.filter((item) => item !== id) : [...state.plan, id]
}

function semesterLabel(semester: number | null) {
  return semester === null ? 'sin semestre sugerido' : `semestre sugerido ${semester}`
}

function suggestionRow({ subject, opens, semester }: PlanSuggestion) {
  return `<li class="plan-row"><div><strong>${escapeHtml(subject.name)}</strong><small>${escapeHtml(subject.code)} · ${subject.credits} cr. · ${semesterLabel(semester)}${subject.sinProgramar ? ' · <span class="course-offer">sin programar 2026-2</span>' : ''}</small></div><span class="plan-opens" title="Materias a las que abre camino">${opens ? `Abre ${opens}` : 'Cierra ruta'}</span><button class="button button-quiet" type="button" data-plan-add="${escapeHtml(subject.id)}" aria-label="Agregar ${escapeHtml(subject.name)} al plan">Agregar</button></li>`
}

function planRow(item: PlanItem) {
  const note = item.state === 'approved'
    ? '<span class="plan-flag ok">Ya aprobada</span>'
    : item.state === 'blocked'
      ? '<span class="plan-flag warn">Requisitos pendientes</span>'
      : ''
  return `<li class="plan-row${item.state === 'approved' ? ' is-done' : ''}"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.code)} · ${item.credits} cr.${item.kind === 'free' ? ' · libre elección' : ''}${item.sinProgramar ? ' · <span class="course-offer">sin programar 2026-2</span>' : ''}</small>${note}</div><div class="plan-row-actions"><button class="text-button" type="button" data-plan-schedule="${escapeHtml(item.id)}"${item.state === 'approved' ? ' disabled' : ''}>Al horario</button><button class="choice-remove" type="button" data-plan-remove="${escapeHtml(item.id)}" aria-label="Quitar ${escapeHtml(item.name)} del plan">×</button></div></li>`
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
    <div class="panel"><div class="panel-heading"><div><span class="panel-kicker">Tu plan</span><h2>${items.length ? `${items.length} materia${items.length === 1 ? '' : 's'}` : 'Plan vacío'}</h2></div>${items.length ? '<button class="text-button" type="button" data-plan-clear>Vaciar plan</button>' : ''}</div>${planList}${freePicker}${unlockedList}</div>
  </section>`
}

export function bindPlanner(root: HTMLElement) {
  const state = store.state
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
