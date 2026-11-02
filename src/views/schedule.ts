import { subjects } from '../data/curriculum'
import { offerAgeDays, offerFor, offerLoaded, offerMeta, type OfferGroup } from '../data/sia-offer'
import { findConflict, scheduleAsText, slotColor, timeToMinutes, upsertSlot, validateSlot, DAY_END, DAY_START } from '../domain/schedule'
import { scheduleDays, type ScheduleDay, type ScheduleSlot } from '../domain/state'
import { isApproved, isFreeChoiceApproved } from '../app/selectors'
import { commit, render, store } from '../app/store'
import { escapeHtml, formatIsoDate } from '../ui/html'
import { icon } from '../ui/icons'
import { showToast } from '../ui/toast'

const hourMarks = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00']

function scheduleCourse(id: string) {
  return subjects.find((course) => course.id === id) ?? store.state.freeChoice.find((course) => course.id === id)
}

function option(id: string, label: string, selected: boolean) {
  return `<option value="${escapeHtml(id)}"${selected ? ' selected' : ''}>${label}</option>`
}

/** Approved courses are hidden unless they are the one being edited or preselected. */
function courseOptions(selectedId: string | null) {
  const state = store.state
  const plan = subjects.filter((subject) => subject.id === selectedId || !isApproved(subject))
  const free = state.freeChoice.filter((course) => course.id === selectedId || !isFreeChoiceApproved(course))
  const hidden = subjects.length + state.freeChoice.length - plan.length - free.length
  const planOptions = plan.map((subject) => option(subject.id, `${escapeHtml(subject.name)} · ${escapeHtml(subject.code)}${subject.sinProgramar ? ' · sin programar 2026-2' : ''}`, subject.id === selectedId)).join('')
  const freeOptions = free.map((course) => option(course.id, `${escapeHtml(course.name)} · ${escapeHtml(course.code)}`, course.id === selectedId)).join('')
  return {
    firstId: plan[0]?.id ?? free[0]?.id ?? null,
    html: `<optgroup label="Plan de estudios">${planOptions}</optgroup>${freeOptions ? `<optgroup label="Libre elección">${freeOptions}</optgroup>` : ''}`,
    hidden,
  }
}

export function renderSchedule() {
  const state = store.state
  const slotCount = state.schedule.length
  const editing = store.editingSlotId ? state.schedule.find((slot) => slot.id === store.editingSlotId) : undefined
  if (!editing) store.editingSlotId = null
  const selectedId = editing?.subjectId ?? store.pendingScheduleSubjectId
  const options = courseOptions(selectedId)
  const panelId = selectedId ?? options.firstId
  const panelSubject = subjects.find((subject) => subject.id === panelId)
  // With real SIA groups for the course, manual entry becomes secondary.
  const selectedOffer = !!panelSubject && !!offerFor(panelSubject.code)?.groups.length
  const value = (field: 'start' | 'end' | 'group' | 'room', fallback: string) => escapeHtml(editing?.[field] ?? fallback)
  return `<section class="page-heading compact"><div><div class="eyebrow"><span class="eyebrow-dot"></span> Planeación semanal</div><h1>Arma tu <em>semana.</em></h1><p class="lede">Elige grupos reales del SIA o agrega bloques a mano, y detecta choques antes de inscribir.</p></div><div class="heading-note"><span>FUENTE</span><strong>Grupos del SIA${offerMeta()?.term ? ` ${offerMeta()!.term}` : ''}</strong><small>${offerMeta() ? `Consultados el ${formatIsoDate(offerMeta()!.consultedAt.slice(0, 10))}` : 'Cargando oferta'} · también puedes cargar bloques a mano</small></div></section>
  <section class="schedule-toolbar"><div><span class="panel-kicker">Tu horario</span><h2>${slotCount ? `${slotCount} bloque${slotCount === 1 ? '' : 's'} guardado${slotCount === 1 ? '' : 's'}` : 'Todavía no hay bloques'}</h2></div><div class="toolbar-controls"><button class="button button-outline" data-action="copy-schedule" ${slotCount ? '' : 'disabled'}>${icon('download')} Copiar</button><button class="button button-solid" data-action="print-schedule">Imprimir</button><button class="text-button" data-action="clear-schedule" ${slotCount ? '' : 'disabled'}>Vaciar</button></div></section>
  <section class="schedule-workspace"><form class="schedule-form${editing ? ' is-editing' : ''}" data-schedule-form><div class="schedule-form-head"><span class="panel-kicker">${editing ? 'Editar bloque' : 'Agregar bloque'}</span><p>Solo guardamos estos datos en tu navegador.</p></div><label><span>Materia</span><select name="subjectId" required>${options.html}</select>${options.hidden ? `<small class="field-help">${options.hidden} materia${options.hidden === 1 ? '' : 's'} aprobada${options.hidden === 1 ? '' : 's'} no se muestra${options.hidden === 1 ? '' : 'n'}.</small>` : ''}</label><details class="manual-block"${editing || !selectedOffer ? ' open' : ''}><summary>${editing ? 'Datos del bloque' : 'Agregar un bloque a mano'}</summary><div class="schedule-form-grid"><label><span>Día</span><select name="day">${scheduleDays.map((day) => `<option value="${day}"${editing?.day === day ? ' selected' : ''}>${day}</option>`).join('')}</select></label><label><span>Grupo</span><input name="group" maxlength="20" placeholder="Opcional" value="${value('group', '')}" /></label><label><span>Inicio</span><input name="start" type="time" min="07:00" max="20:59" value="${value('start', '07:00')}" required /></label><label><span>Fin</span><input name="end" type="time" min="07:01" max="21:00" value="${value('end', '09:00')}" required /></label><label><span>Salón</span><input name="room" maxlength="30" placeholder="Opcional" value="${value('room', '')}" /></label></div><div class="schedule-form-actions"><button class="button button-solid" type="submit">${editing ? 'Guardar cambios' : 'Agregar al horario'} ${icon('arrow')}</button>${editing ? '<button class="button button-quiet" type="button" data-schedule-cancel>Cancelar edición</button>' : ''}</div></details></form>${renderOfferPanel(panelId)}</section>
  <div class="week-grid"><div class="time-axis">${hourMarks.map((time) => `<span>${time}</span>`).join('')}</div>${scheduleDays.map((day) => `<div class="day-column"><strong>${day}</strong><div class="day-lines">${state.schedule.filter((slot) => slot.day === day).sort((a, b) => a.start.localeCompare(b.start)).map(renderScheduleSlot).join('') || '<span class="day-empty">Sin bloques</span>'}</div></div>`).join('')}</div>`
}

function groupKey(group: OfferGroup) {
  return `${group.activity}|${group.group}`
}

/** Real groups from the SIA snapshot for the selected course, each addable as schedule blocks. */
function renderOfferPanel(subjectId: string | null) {
  const subject = subjects.find((item) => item.id === subjectId)
  const offer = subject ? offerFor(subject.code) : undefined
  const info = offerMeta()
  const source = info ? `Buscador de cursos del SIA${info.term ? ` · periodo ${info.term}` : ''} · consultado el ${formatIsoDate(info.consultedAt.slice(0, 10))}` : 'Buscador de cursos del SIA'
  const body = !offerLoaded()
    ? '<p>Cargando la oferta del SIA…</p>'
    : !subject
    ? '<p>Las materias de libre elección se agregan manualmente con el formulario.</p>'
    : !offer
      ? '<p>Esta materia no aparece en el último snapshot del SIA.</p>'
      : offer.unscheduled
        ? '<p>El SIA la lista como <strong>asignatura sin programar</strong> este periodo.</p>'
        : !offer.detailed || !offer.groups.length
          ? '<p>El SIA la lista como programada, pero no se pudieron leer sus grupos. Consulta el buscador oficial.</p>'
          : offer.activities.map((activity) => `<div class="offer-activity"><h4>${escapeHtml(activity)}</h4><ul>${offer.groups.filter((group) => group.activity === activity).map((group) => `<li class="offer-group${group.seats === 0 ? ' is-full' : ''}"><div><strong>Grupo ${escapeHtml(group.group)}</strong><small>${escapeHtml(group.teacher ?? 'Profesor no informado')} · ${group.seats ? `${group.seats} cupo${group.seats === 1 ? '' : 's'}` : '<span class="offer-full">sin cupos</span>'}</small><span>${group.sessions.map((session) => `${escapeHtml(session.day.slice(0, 3))} ${session.start}–${session.end}`).join(' · ') || 'Horario no informado'}</span></div><button class="button button-quiet" type="button" data-offer-add="${escapeHtml(groupKey(group))}"${group.sessions.length ? '' : ' disabled'}>Agregar</button></li>`).join('')}</ul></div>`).join('')
  const age = offerAgeDays()
  const stale = age !== null && age > 14 ? `<p class="offer-stale" role="note">Estos datos tienen ${age} días. Los cupos y grupos pueden haber cambiado: confirma en el SIA o actualiza el snapshot.</p>` : ''
  return `<aside class="schedule-note offer-panel">${stale}<span class="panel-kicker">Grupos del SIA</span><h3>${subject ? escapeHtml(subject.name) : 'Libre elección'}</h3>${body}<small class="offer-source">${source}. Los cupos cambian durante la inscripción: confirma en el SIA.</small></aside>`
}

function renderScheduleSlot(slot: ScheduleSlot) {
  const name = scheduleCourse(slot.subjectId)?.name
  const details = [slot.group && `Grupo ${escapeHtml(slot.group)}`, slot.room && escapeHtml(slot.room)].filter(Boolean).join(' · ')
  const start = Math.max(DAY_START, Math.min(DAY_END, timeToMinutes(slot.start)))
  const end = Math.max(start + 15, Math.min(DAY_END, timeToMinutes(slot.end)))
  const top = ((start - DAY_START) / (DAY_END - DAY_START)) * 100
  const height = ((end - start) / (DAY_END - DAY_START)) * 100
  const label = escapeHtml(name ?? 'bloque')
  return `<article class="schedule-block${slot.id === store.editingSlotId ? ' is-editing' : ''}" data-color="${slotColor(slot.subjectId)}" style="top:${top}%;height:${height}%"><div class="schedule-block-time">${slot.start}–${slot.end}</div><strong>${escapeHtml(name ?? 'Materia eliminada')}</strong>${details ? `<small>${details}</small>` : ''}<div class="schedule-block-actions"><button type="button" data-schedule-edit="${escapeHtml(slot.id)}" aria-label="Editar ${label}" title="Editar">✎</button><button type="button" data-schedule-remove="${escapeHtml(slot.id)}" aria-label="Quitar ${label}" title="Quitar">×</button></div></article>`
}

const problems = {
  incomplete: ['Faltan datos', 'Elige una materia, un día y horas válidas.'],
  order: ['El bloque no se puede guardar', 'La hora de fin debe ser posterior a la hora de inicio.'],
  range: ['Horario fuera del tablero', 'Usa horas entre 07:00 y 21:00.'],
} as const

export function bindSchedule(root: HTMLElement) {
  const state = store.state
  const courseSelect = root.querySelector<HTMLSelectElement>('[data-schedule-form] select[name="subjectId"]')
  courseSelect?.addEventListener('change', () => {
    if (store.editingSlotId) return
    store.pendingScheduleSubjectId = courseSelect.value
    render()
    document.querySelector<HTMLSelectElement>('[data-schedule-form] select[name="subjectId"]')?.focus({ preventScroll: true })
  })
  root.querySelectorAll<HTMLButtonElement>('[data-offer-add]').forEach((button) => button.addEventListener('click', () => {
    const subject = subjects.find((item) => item.id === courseSelect?.value)
    const group = subject && offerFor(subject.code)?.groups.find((item) => groupKey(item) === button.dataset.offerAdd)
    if (!subject || !group) return
    const stamp = Date.now()
    const candidates: ScheduleSlot[] = group.sessions.map((session, index) => ({
      id: `${stamp}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      subjectId: subject.id,
      day: session.day as ScheduleDay,
      start: session.start,
      end: session.end,
      group: `${group.group} · ${group.activity.replace(/^CLASE /, '').split('-')[0].toLowerCase()}`.slice(0, 20),
      room: session.place.slice(0, 30),
    }))
    // All sessions or none, checked against existing blocks and each other.
    let next = state.schedule
    for (const candidate of candidates) {
      const problem = validateSlot(next, candidate)
      if (problem) {
        const other = problem === 'conflict' ? findConflict(next, candidate) : undefined
        showToast('No se agregó el grupo', other
          ? `${candidate.day} ${candidate.start}–${candidate.end} se cruza con ${scheduleCourse(other.subjectId)?.name ?? 'otro bloque'}.`
          : `${candidate.day} ${candidate.start}–${candidate.end} queda fuera del tablero (lunes a sábado, 07:00 a 21:00).`)
        return
      }
      next = [...next, candidate]
    }
    state.schedule = next
    commit()
    showToast('Grupo agregado', `${subject.name} · grupo ${group.group}: ${candidates.length} bloque${candidates.length === 1 ? '' : 's'}.`)
  }))
  root.querySelector<HTMLFormElement>('[data-schedule-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget as HTMLFormElement)
    const candidate: ScheduleSlot = {
      id: store.editingSlotId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subjectId: String(data.get('subjectId') ?? ''),
      day: String(data.get('day') ?? 'Lunes') as ScheduleDay,
      start: String(data.get('start') ?? ''),
      end: String(data.get('end') ?? ''),
      group: String(data.get('group') ?? '').trim(),
      room: String(data.get('room') ?? '').trim(),
    }
    const problem = validateSlot(state.schedule, candidate)
    if (problem === 'conflict') {
      const other = findConflict(state.schedule, candidate)!
      showToast('Hay un choque de horario', `Se cruza con ${scheduleCourse(other.subjectId)?.name ?? 'otro bloque'} el ${candidate.day} de ${other.start} a ${other.end}.`)
      return
    }
    if (problem) {
      const [title, message] = problems[problem]
      showToast(title, message)
      return
    }
    const edited = store.editingSlotId !== null
    state.schedule = upsertSlot(state.schedule, candidate)
    store.pendingScheduleSubjectId = null
    store.editingSlotId = null
    commit()
    if (edited) showToast('Bloque actualizado', `${scheduleCourse(candidate.subjectId)?.name ?? 'El bloque'} quedó el ${candidate.day} de ${candidate.start} a ${candidate.end}.`)
  })
  root.querySelector<HTMLButtonElement>('[data-schedule-cancel]')?.addEventListener('click', () => {
    store.editingSlotId = null
    render()
  })
  root.querySelectorAll<HTMLElement>('[data-schedule-edit]').forEach((element) => element.addEventListener('click', () => {
    store.editingSlotId = element.dataset.scheduleEdit ?? null
    render()
    const form = document.querySelector<HTMLFormElement>('[data-schedule-form]')
    form?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    form?.querySelector<HTMLSelectElement>('select[name="subjectId"]')?.focus({ preventScroll: true })
  }))
  root.querySelectorAll<HTMLElement>('[data-schedule-remove]').forEach((element) => element.addEventListener('click', () => {
    const id = element.dataset.scheduleRemove
    state.schedule = state.schedule.filter((slot) => slot.id !== id)
    if (store.editingSlotId === id) store.editingSlotId = null
    commit()
  }))
  root.querySelector<HTMLElement>('[data-action="copy-schedule"]')?.addEventListener('click', async () => {
    if (!state.schedule.length) return
    try {
      await navigator.clipboard.writeText(scheduleAsText(state.schedule, (id) => scheduleCourse(id)?.name))
      showToast('Horario copiado', 'Ya puedes pegarlo en tus notas o compartirlo.')
    } catch {
      showToast('No se pudo copiar', 'Tu navegador bloqueó el portapapeles. Usa Imprimir o copia los bloques manualmente.')
    }
  })
  root.querySelector<HTMLElement>('[data-action="print-schedule"]')?.addEventListener('click', () => window.print())
  root.querySelector<HTMLElement>('[data-action="clear-schedule"]')?.addEventListener('click', () => {
    if (!state.schedule.length || !window.confirm('¿Vaciar todos los bloques del horario?')) return
    state.schedule = []
    store.editingSlotId = null
    commit()
  })
}
