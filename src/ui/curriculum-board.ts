import { courseCodeKey, subjects, type Subject } from '../data/curriculum'
import { referenceSemesters, type ReferenceSlot } from '../data/reference-layout'
import { electiveCandidates, referenceSlot, type ElectiveAssignments, type FreeChoice } from '../domain/electives'
import './curriculum-board.css'

type CourseStatus = 'aprobada' | 'reprobada' | 'pendiente' | 'disponible' | 'parcial' | 'bloqueada'
export type BoardOptions = {
  status: (subject: Subject) => CourseStatus
  missing: (subject: Subject) => string[]
  approved: (subject: Subject) => boolean
  note: (id: string) => number | undefined
  saveGrade: (subject: Subject, grade: number | undefined) => void
  electiveAssignments: ElectiveAssignments
  freeChoices: FreeChoice[]
  assignElective: (key: string, id: string | null) => void
  inspectId?: string
  update: (subject: Subject, status: 'aprobada' | 'pendiente' | 'clear') => void
  schedule: (subject: Subject) => void
}
const labels: Record<CourseStatus, string> = { aprobada: 'Aprobada', reprobada: 'Reprobada', pendiente: 'Pendiente', disponible: 'Requisitos registrados cumplidos', parcial: 'Requisitos parciales', bloqueada: 'Requisitos pendientes' }
const shortLabels: Record<CourseStatus, string> = { ...labels, disponible: 'Disponible', parcial: 'Parcial', bloqueada: 'Bloqueada' }
// Offer snapshot from the SIA extraction, not a live schedule.
const offerLabel = 'Sin programar en 2026-2 según el SIA'
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const byCode = new Map(subjects.map((subject) => [courseCodeKey(subject.code), subject]))
const placed = new Set(referenceSemesters.flat().filter((cell): cell is string => typeof cell === 'string').map(courseCodeKey))
// Presentation state survives academic updates without resetting the user's place.
let viewState = { query: '', filter: 'all', kind: '', catalogueOpen: false, scrollLeft: 0 }

function gradeEditor(subject: Subject, options: BoardOptions) {
  const grade = options.note(subject.id)
  return `<form class="course-grade" data-grade-form><label for="course-grade-input">Nota final <span>opcional</span></label><div><input id="course-grade-input" type="number" min="0" max="5" step="0.1" value="${grade ?? ''}" placeholder="0.0 a 5.0" inputmode="decimal" aria-describedby="course-grade-help" /><button type="submit">Guardar nota</button>${grade !== undefined ? '<button type="button" data-grade-remove aria-label="Quitar nota conservando el estado">Quitar</button>' : ''}</div><small id="course-grade-help">${grade !== undefined ? 'La nota participa en tu promedio registrado.' : 'Registra resultados aprobados o reprobados. Si faltan requisitos en la app, se señalará como inconsistencia para revisar.'}</small></form>`
}

// A visual ranking by name, never a declaration of official grouping eligibility.
function matchesReferenceName(slot: ReferenceSlot, name: string) {
  const label = normalize(slot.label)
  const course = normalize(name)
  if (label.includes('probabilidad')) return /probabilidad|estadistica/.test(course)
  if (label.includes('administracion')) return /administracion|gerencia|gestion/.test(course)
  if (label.includes('digital')) return /digital|embebid/.test(course)
  if (label.includes('analoga')) return /analoga|lineales/.test(course)
  if (label.includes('telecomunicaciones')) return /telecomunicaciones|\brf\b/.test(course)
  return false
}

function courseTile(subject: Subject, options: BoardOptions) {
  const status = options.status(subject)
  return `<button type="button" class="course-tile" data-course="${escape(subject.id)}" data-status="${status}" data-track="${subject.track}" aria-expanded="false" aria-controls="course-preview" aria-label="${escape(subject.name)}, ${subject.credits} créditos, ${labels[status]}${subject.sinProgramar ? `, ${offerLabel}` : ''}">
    <span class="course-meta"><span>${escape(subject.code)}</span><span>${subject.sinProgramar ? `<span class="course-offer" title="${offerLabel}">No ofertada · </span>` : ''}${subject.credits} cr.</span></span>
    <span class="course-name">${escape(subject.name)}</span>
    <span class="course-foot"><span class="course-status">${shortLabels[status]}${options.note(subject.id) !== undefined ? ` · ${options.note(subject.id)!.toFixed(1)}` : ''}</span><span class="course-hint" aria-hidden="true">↗</span></span>
  </button>`
}

function slotTile(slot: ReferenceSlot, key: string, options: BoardOptions) {
  const id = options.electiveAssignments[key]
  const course = subjects.find((subject) => subject.id === id)
  if (course) return `<div class="assigned-course">${courseTile(course, options)}<button class="slot-change" data-slot-key="${key}" aria-label="Cambiar ${escape(course.name)} en este espacio" title="Cambiar elección">↺</button></div>`
  const free = options.freeChoices.find((subject) => subject.id === id)
  return `<button type="button" class="course-slot ${free ? 'is-assigned' : ''}" data-slot-key="${key}"><span>${escape(free?.name ?? slot.label)}</span><small>${free ? `${free.credits} cr. · planificada · cambiar` : slot.kind === 'free' ? '+ Elegir libre elección' : '+ Elegir optativa'}</small></button>`
}

export function renderCurriculumBoard(options: BoardOptions) {
  const available = subjects.filter((subject) => options.status(subject) === 'disponible').length
  const assigned = new Set(Object.values(options.electiveAssignments))
  const catalogue = subjects.filter((subject) => !placed.has(courseCodeKey(subject.code)) && !assigned.has(subject.id))
  return `<section class="curriculum-workspace" aria-label="Explorador de la malla curricular">
    <div class="board-controls"><div class="board-tabs" role="group" aria-label="Filtrar materias"><button class="is-active" data-course-filter="all" aria-pressed="true">Todas <span>${subjects.length}</span></button><button data-course-filter="available" aria-pressed="false">Disponibles <span>${available}</span></button><button data-course-filter="approved" aria-pressed="false">Aprobadas</button></div><label class="course-search"><span aria-hidden="true">⌕</span><input type="search" data-course-search placeholder="Buscar materia o código" aria-label="Buscar materia o código" /></label></div>
    <div class="map-intro"><span><i class="track-key foundation"></i> Fundamentación <i class="track-key disciplinary"></i> Disciplinar <i class="track-key elective"></i> Elección</span><span>Explora una materia · clic para fijar detalles</span></div>
    <p class="board-search-feedback" role="status" hidden></p>
    <div class="curriculum-viewport" tabindex="0" aria-label="Malla por semestres. Desplazamiento horizontal disponible.">
      <div class="curriculum-grid"><svg class="curriculum-edges" aria-hidden="true"></svg>${referenceSemesters.map((cells, index) => `<section class="curriculum-column" aria-label="Semestre ${index + 1}"><header><span>SEMESTRE</span><strong>${String(index + 1).padStart(2, '0')}</strong></header>${cells.map((cell, row) => {
        if (!cell) return '<div class="course-empty"></div>'
        if (typeof cell !== 'string') return slotTile(cell, `${index + 1}:${row + 1}`, options)
        const subject = byCode.get(courseCodeKey(cell))
        return subject ? courseTile(subject, options) : '<div class="course-empty">Asignatura sin correspondencia</div>'
      }).join('')}</section>`).join('')}</div>
    </div>
    <div class="board-bottom"><span>Orden visual de la malla de referencia · requisitos del catálogo SIA</span><div><button data-pan="-1" aria-label="Ver semestres anteriores">←</button><button data-pan="1" aria-label="Ver semestres siguientes">→</button></div></div>
    <details class="course-catalogue"><summary><span>Optativas y alternativas de grado</span><span>${catalogue.length} opciones sin ubicar</span></summary><p>Son alternativas del catálogo, no materias adicionales que debas aprobar todas. Al ubicar una opción en el mapa, deja de aparecer en esta lista; los espacios de elección son orientativos.</p><div class="alternative-grid">${catalogue.map((subject) => courseTile(subject, options)).join('')}</div></details>
    <div id="course-preview" class="course-preview" role="region" aria-label="Detalle de la materia" hidden></div>
    <dialog class="elective-picker" aria-labelledby="elective-picker-title"></dialog>
  </section>`
}

/** The board owns ephemeral interactions only. Academic state stays in the app. */
export function mountCurriculumBoard(root: HTMLElement, options: BoardOptions): () => void {
  const board = root.querySelector<HTMLElement>('.curriculum-workspace')
  if (!board) return () => {}
  const controller = new AbortController()
  const { signal } = controller
  const preview = board.querySelector<HTMLElement>('.course-preview')!
  const viewport = board.querySelector<HTMLElement>('.curriculum-viewport')!
  const grid = board.querySelector<HTMLElement>('.curriculum-grid')!
  const edges = board.querySelector<SVGSVGElement>('.curriculum-edges')!
  const tiles = [...board.querySelectorAll<HTMLButtonElement>('[data-course]')]
  const catalogue = board.querySelector<HTMLDetailsElement>('.course-catalogue')!
  const picker = board.querySelector<HTMLDialogElement>('.elective-picker')!
  let selectedSlot = ''
  function openPicker(button: HTMLButtonElement) {
    close()
    selectedSlot = button.dataset.slotKey!
    const slot = referenceSlot(selectedSlot)
    if (!slot) return
    const candidates = electiveCandidates(slot, options.freeChoices)
    const current = options.electiveAssignments[selectedSlot]
    const candidateButton = (course: typeof candidates[number]) => {
      const elsewhere = Object.entries(options.electiveAssignments).some(([key, id]) => key !== selectedSlot && (id === course.id || options.freeChoices.some((item) => item.id === id && courseCodeKey(item.code) === courseCodeKey(course.code))))
      return `<button data-elective-id="${escape(course.id)}" ${elsewhere ? 'disabled' : ''} aria-pressed="${current === course.id}"><span>${escape(course.name)}<small>${escape(course.code)} · ${course.credits} créditos${elsewhere ? ' · ya elegida en otro espacio' : current === course.id ? ' · elección actual' : ''}</small></span><span aria-hidden="true">${current === course.id ? '✓' : '+'}</span></button>`
    }
    const matching = candidates.filter((course) => matchesReferenceName(slot, course.name))
    const other = candidates.filter((course) => !matchesReferenceName(slot, course.name))
    const choices = matching.length
      ? `<p class="picker-group-label">Coincidencias por nombre · confirmar agrupación</p>${matching.map(candidateButton).join('')}${other.length ? `<details class="picker-other"><summary>Otras opciones del componente (${other.length})</summary><div class="picker-options">${other.map(candidateButton).join('')}</div></details>` : ''}`
      : candidates.map(candidateButton).join('')
    picker.innerHTML = `<div class="picker-heading"><div><small>Semestre ${selectedSlot.split(':')[0]} · elección personal</small><h2 id="elective-picker-title">${escape(slot.label)}</h2></div><button data-picker-close aria-label="Cerrar selección">×</button></div><p>${slot.kind === 'free' ? 'Elige una materia de tu catálogo personal. Aquí solo planificas su ubicación; no cuenta como aprobada.' : 'Elige una optativa del componente. El SIA no publica aquí su agrupación: verifica que corresponda a este espacio.'}</p><div class="picker-options">${choices || '<p class="picker-empty">Aún no hay materias en tu catálogo personal. Agrégalas o importa un catálogo desde Libre elección.</p>'}</div><div class="picker-footer">${current ? '<button data-elective-clear>Dejar espacio sin elegir</button>' : ''}${slot.kind === 'free' ? '<button data-manage-free>Gestionar libre elección</button>' : '<small>Elegir una materia no la aprueba ni la inscribe.</small>'}</div>`
    picker.showModal()
  }
  picker.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!button || button.disabled) return
    if (button.hasAttribute('data-picker-close')) picker.close()
    if (button.hasAttribute('data-elective-clear')) { picker.close(); options.assignElective(selectedSlot, null) }
    if (button.dataset.electiveId) { picker.close(); options.assignElective(selectedSlot, button.dataset.electiveId) }
    if (button.hasAttribute('data-manage-free')) { picker.close(); root.querySelector<HTMLButtonElement>('[data-view="libre"]')?.click() }
  }, { signal })
  let active: Subject | undefined
  let anchor: HTMLButtonElement | undefined
  let pinned = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let frame = 0
  let filter = viewState.filter
  let query = viewState.query
  let kind = viewState.kind

  function clearTimer() { if (timer !== undefined) clearTimeout(timer) }
  function close(restoreFocus = false) {
    clearTimer()
    preview.hidden = true
    tiles.forEach((tile) => { tile.classList.remove('is-inspected', 'is-prerequisite', 'is-dependent'); tile.setAttribute('aria-expanded', 'false') })
    edges.replaceChildren()
    active = undefined
    pinned = false
    if (restoreFocus) anchor?.focus({ preventScroll: true })
  }
  function position() {
    if (!anchor || preview.hidden) return
    const rect = anchor.getBoundingClientRect()
    const margin = 12
    const width = Math.min(380, window.innerWidth - margin * 2)
    preview.style.width = `${width}px`
    preview.style.maxHeight = `${window.innerHeight - margin * 2}px`
    const gap = 12
    const fitsLeft = rect.left - width - gap >= margin
    const fitsRight = rect.right + gap + width <= window.innerWidth - margin
    const left = fitsLeft ? rect.left - width - gap : fitsRight ? rect.right + gap : (window.innerWidth - width) / 2
    preview.dataset.side = fitsLeft ? 'left' : fitsRight ? 'right' : 'center'
    preview.style.left = `${Math.max(margin, left)}px`
    preview.style.top = `${Math.max(margin, Math.min(rect.top, window.innerHeight - preview.offsetHeight - margin))}px`
  }
  function drawRelations(subject: Subject) {
    const prerequisites = new Set(subject.prerequisiteCodes.map(courseCodeKey))
    const dependents = new Set(subjects.filter((item) => item.prerequisiteCodes.some((code) => courseCodeKey(code) === courseCodeKey(subject.code))).map((item) => item.id))
    tiles.forEach((tile) => {
      const item = subjects.find((course) => course.id === tile.dataset.course)!
      tile.classList.toggle('is-inspected', item.id === subject.id)
      tile.classList.toggle('is-prerequisite', prerequisites.has(courseCodeKey(item.code)))
      tile.classList.toggle('is-dependent', dependents.has(item.id))
      tile.setAttribute('aria-expanded', String(item.id === subject.id))
    })
    edges.replaceChildren()
    const source = grid.querySelector<HTMLElement>(`[data-course="${subject.id}"]`)
    if (!source) return
    const bounds = grid.getBoundingClientRect()
    edges.setAttribute('viewBox', `0 0 ${grid.scrollWidth} ${grid.scrollHeight}`)
    const related = [...grid.querySelectorAll<HTMLElement>('.is-prerequisite, .is-dependent')]
    for (const target of related) {
      const before = target.classList.contains('is-prerequisite')
      const from = (before ? target : source).getBoundingClientRect()
      const to = (before ? source : target).getBoundingClientRect()
      const x1 = from.right - bounds.left, y1 = from.top + from.height / 2 - bounds.top
      const x2 = to.left - bounds.left, y2 = to.top + to.height / 2 - bounds.top
      const bend = Math.max(30, Math.abs(x2 - x1) / 2)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`)
      path.setAttribute('class', before ? 'edge-prerequisite' : 'edge-dependent')
      edges.append(path)
    }
  }
  function show(tile: HTMLButtonElement, pin = false) {
    clearTimer()
    if (pinned && !pin) return
    const subject = subjects.find((item) => item.id === tile.dataset.course)!
    const same = active?.id === subject.id
    active = subject
    anchor = tile
    pinned = pin
    const status = options.status(subject)
    const missing = options.missing(subject)
    const additionalMissing = missing.filter((requirement) => !requirement.startsWith('Condición '))
    const note = options.note(subject.id)
    const dependencies = subjects.filter((item) => item.prerequisiteCodes.some((code) => courseCodeKey(code) === courseCodeKey(subject.code)))
    const requirements = subject.prereqGroups === null ? '<p>El catálogo no publica los requisitos de esta materia.</p>' : subject.prereqGroups.length === 0 ? '<p>Sin prerrequisitos de asignaturas publicados.</p>' : subject.prereqGroups.map((group, index) => `<div class="requirement-condition"><strong>${index + 1}. ${group.mode === 'any' ? 'Aprueba una de estas opciones' : 'Aprueba todas estas materias'}</strong><ul>${group.items.map((reference) => {
      const match = byCode.get(courseCodeKey(reference.code))
      const satisfied = match ? options.approved(match) : false
      return `<li class="${satisfied ? 'is-met' : ''}"><span aria-label="${satisfied ? 'Cumplido' : 'Sin aprobación registrada'}">${satisfied ? '✓' : '○'}</span><div>${escape(reference.name)}<small>${escape(reference.code)}${match ? '' : ' · equivalencia fuera del catálogo'}</small></div></li>`
    }).join('')}</ul></div>`).join('')
    preview.innerHTML = `<div class="preview-top"><span>${escape(subject.code)} · ${subject.credits} créditos</span><button data-preview-close aria-label="Cerrar detalle">×</button></div><h2>${escape(subject.name)}</h2><p class="preview-type">${escape(subject.tipologia)}</p>${subject.sinProgramar ? `<p class="preview-offer">${offerLabel}. Verifica la oferta vigente en el SIA antes de planearla.</p>` : ''}<div class="preview-status" data-status="${status}">${labels[status]}${note !== undefined ? ` · nota ${note.toFixed(1)}` : ''}</div>${options.approved(subject) && missing.length ? `<p class="preview-warning">Hay una inconsistencia en el historial: faltan ${escape(missing.join(' · '))}.</p>` : ''}${gradeEditor(subject, options)}<${options.approved(subject) ? 'details' : 'div'} class="preview-scroll">${options.approved(subject) ? '<summary>Prerrequisitos y materias relacionadas</summary>' : ''}<section><h3>Para cursarla</h3>${subject.prereqGroups && subject.prereqGroups.length > 1 ? '<p>Debes cumplir todas las condiciones siguientes.</p>' : ''}${requirements}${additionalMissing.length ? `<p class="preview-warning">${escape(additionalMissing.join(' · '))}</p>` : ''}</section>${dependencies.length ? `<section><h3>Es requisito u opción para</h3><p>${dependencies.map((item) => escape(item.name)).join(' · ')}</p><small>Puede haber otras condiciones por cumplir.</small></section>` : ''}${subject.sinProgramar ? '<p class="preview-warning">Sin programar en la consulta 2026-2. Verifica la oferta del periodo que vas a inscribir.</p>' : ''}${subject.tag === 'Grado' ? '<p class="preview-warning">Revisa la modalidad y los requisitos de grado con la coordinación; este catálogo no incluye todos los requisitos administrativos.</p>' : ''}</${options.approved(subject) ? 'details' : 'div'}><div class="preview-actions"><button data-preview-state="${options.approved(subject) ? 'clear' : 'aprobada'}" ${note !== undefined || (!options.approved(subject) && missing.length) ? 'disabled' : ''}>${note !== undefined ? 'Estado definido por la nota' : options.approved(subject) ? 'Quitar aprobación' : 'Marcar aprobada'}</button><button data-preview-schedule ${missing.length || options.approved(subject) ? 'disabled' : ''}>Planificar horario</button></div><button class="preview-pin" data-preview-pin>${pin ? 'Detalle fijado · Esc para cerrar' : 'Fijar detalle para interactuar'}</button>`
    preview.hidden = false
    preview.classList.toggle('is-pinned', pin)
    if (!same && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) preview.animate([{ opacity: 0, transform: 'scale(.96) translateY(5px)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }], { duration: 180, easing: 'ease-out' })
    position()
    drawRelations(subject)
  }
  function leave() { if (!pinned) { clearTimer(); timer = setTimeout(() => close(), 300) } }
  function applyFilters() {
    close()
    let count = 0
    tiles.forEach((tile) => {
      const subject = subjects.find((item) => item.id === tile.dataset.course)!
      const matches = normalize(`${subject.name} ${subject.code}`).includes(query) && (filter === 'all' || (filter === 'available' ? options.status(subject) === 'disponible' : options.approved(subject))) && (!kind || (!placed.has(courseCodeKey(subject.code)) && (kind === 'foundation' ? subject.track === 'fundamentacion' : subject.track === 'profesional')))
      tile.classList.toggle('is-filtered', !matches)
      tile.setAttribute('aria-disabled', String(!matches))
      tile.tabIndex = matches ? 0 : -1
      if (matches) count++
    })
    const feedback = board!.querySelector<HTMLElement>('.board-search-feedback')!
    feedback.hidden = !query && filter === 'all' && !kind
    feedback.textContent = count ? `${count} materias coinciden. Se conserva su posición en la malla.` : 'No hay materias que coincidan. Prueba otro nombre o selecciona Todas.'
    if (query || kind) catalogue.open = true
    board!.querySelectorAll<HTMLButtonElement>('[data-course-filter]').forEach((item) => { item.classList.toggle('is-active', item.dataset.courseFilter === filter); item.setAttribute('aria-pressed', String(item.dataset.courseFilter === filter)) })
  }
  for (const tile of tiles) {
    tile.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse' && !tile.classList.contains('is-filtered')) { clearTimer(); timer = setTimeout(() => show(tile), 140) } }, { signal })
    tile.addEventListener('pointerleave', leave, { signal })
    tile.addEventListener('click', () => { if (!tile.classList.contains('is-filtered')) { show(tile, true); preview.querySelector<HTMLButtonElement>('[data-preview-close]')?.focus({ preventScroll: true }) } }, { signal })
  }
  preview.addEventListener('pointerenter', clearTimer, { signal })
  preview.addEventListener('pointerleave', leave, { signal })
  preview.addEventListener('focusin', () => { pinned = true; clearTimer() }, { signal })
  preview.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-grade-form]') || !active) return
    event.preventDefault()
    const input = event.target.querySelector<HTMLInputElement>('input')!
    if (!event.target.reportValidity()) return
    options.saveGrade(active, input.value === '' ? undefined : input.valueAsNumber)
  }, { signal })
  preview.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!target || target.disabled || !active) return
    if (target.hasAttribute('data-preview-close')) { close(true); return }
    if (target.hasAttribute('data-preview-pin')) { show(anchor!, true); return }
    if (target.hasAttribute('data-preview-schedule')) options.schedule(active)
    if (target.hasAttribute('data-grade-remove')) options.saveGrade(active, undefined)
    if (target.dataset.previewState) options.update(active, target.dataset.previewState as 'aprobada' | 'clear')
  }, { signal })
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !preview.hidden) { event.preventDefault(); close(true) } }, { signal })
  document.addEventListener('pointerdown', (event) => { if (pinned && !preview.contains(event.target as Node) && !(event.target as HTMLElement).closest('[data-course]')) close() }, { signal })
  board.querySelector<HTMLInputElement>('[data-course-search]')!.addEventListener('input', (event) => { query = normalize((event.target as HTMLInputElement).value.trim()); kind = ''; applyFilters() }, { signal })
  board.querySelectorAll<HTMLButtonElement>('[data-course-filter]').forEach((button) => button.addEventListener('click', () => {
    filter = button.dataset.courseFilter!; kind = ''
    board.querySelectorAll<HTMLButtonElement>('[data-course-filter]').forEach((item) => { item.classList.toggle('is-active', item === button); item.setAttribute('aria-pressed', String(item === button)) })
    applyFilters()
  }, { signal }))
  board.querySelectorAll<HTMLButtonElement>('[data-slot-key]').forEach((button) => button.addEventListener('click', () => openPicker(button), { signal }))
  board.querySelectorAll<HTMLButtonElement>('[data-pan]').forEach((button) => button.addEventListener('click', () => { close(); viewport.scrollBy({ left: Number(button.dataset.pan) * viewport.clientWidth * .75, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }, { signal }))
  let restoredScroll: number | undefined = viewState.scrollLeft
  viewport.addEventListener('scroll', () => {
    const restored = restoredScroll !== undefined && Math.abs(viewport.scrollLeft - restoredScroll) < 1
    restoredScroll = undefined
    if (!restored) close()
  }, { signal, passive: true })
  window.addEventListener('resize', () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { position(); if (active) drawRelations(active) }) }, { signal })
  window.addEventListener('scroll', () => { if (!preview.hidden) position() }, { signal, passive: true })
  board.querySelector<HTMLInputElement>('[data-course-search]')!.value = query
  catalogue.open = viewState.catalogueOpen
  applyFilters()
  viewport.scrollLeft = viewState.scrollLeft
  if (options.inspectId) {
    const tile = tiles.find((item) => item.dataset.course === options.inspectId)
    if (tile) { show(tile, true); preview.querySelector<HTMLElement>('[data-preview-close]')?.focus({ preventScroll: true }) }
  }
  return () => {
    viewState = { query, filter, kind, catalogueOpen: catalogue.open, scrollLeft: viewport.scrollLeft }
    controller.abort(); clearTimer(); cancelAnimationFrame(frame)
  }
}
