import { curriculumMeta, subjects, supportSubjects } from '../data/curriculum'
import { referenceFreeSlotCount } from '../data/reference-layout'
import { readElectiveAssignments } from '../domain/electives'
import { cumulativeAverage, recordedAverage } from '../domain/grades'
import { approvedCredits, prerequisiteGroupLabel, prerequisiteGroupSatisfied, recordBalance, type RequirementStatus } from '../domain/progress'
import { canApprove, getMissingRequirements, getStatus, isApproved, statusInfo, supportStatus } from '../app/selectors'
import { commit, navigate, store } from '../app/store'
import { mountCurriculumBoard, renderCurriculumBoard, type BoardOptions } from '../ui/curriculum-board'
import { formatIsoDate } from '../ui/html'
import { icon } from '../ui/icons'
import { showToast } from '../ui/toast'
import { togglePlanned } from './planner'

const totalCredits = curriculumMeta.regularCredits

export function renderMalla() {
  const state = store.state
  const approved = approvedCredits(state)
  const percentage = Math.round((approved / totalCredits) * 100)
  const average = recordedAverage(state.notes, state.freeChoice, state.freeChoiceNotes)
  const cumulative = cumulativeAverage(state.notes, state.attempts, state.freeChoice, state.freeChoiceNotes)
  return `
    <section class="curriculum-heading"><div><p>UNAL Bogotá <span>/</span> Plan 2545</p><h1>Ingeniería Electrónica<span>.</span></h1><p>Tu carrera, materia por materia.</p></div><div class="curriculum-metrics"><div class="recorded-average"><span>PAPA estimado</span><strong data-recorded-average>${cumulative.value?.toFixed(2) ?? 'Sin notas'}</strong><small>PA ${average.value?.toFixed(2) ?? '—'} · ${average.courses} materias · ${cumulative.credits} créditos cursados</small><details><summary>¿Cómo se calcula?</summary><p>Ponderado por créditos con notas numéricas del plan, libre elección, Matemáticas Básicas y Lectoescritura. El PA usa la última nota de cada materia; el PAPA suma también los intentos anteriores que registres en Notas. Inglés AP/RE y aprobaciones sin nota no se ponderan. Es una estimación: no reemplaza el PAPA oficial del SIA.</p></details></div><div class="curriculum-progress"><strong>${approved}<span> / ${totalCredits} cr.</span></strong><div role="progressbar" aria-label="Créditos aprobados" aria-valuenow="${Math.min(100, percentage)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, percentage)}%"></i></div><small>${percentage}% del plan registrado</small></div></div></section>
    ${renderProfileNotice()}
    ${renderCreditBalance()}
    ${renderCurriculumBoard(boardOptions())}
    <details class="curriculum-support" id="support-tracks" data-panel="support"${store.openPanels.has('support') ? ' open' : ''}><summary>Nivelación y lengua extranjera <span>Configurar mi situación</span></summary>${renderSupportTracks()}</details>
    <footer class="curriculum-footer"><span>Avance guardado en este navegador · datos del SIA consultados el ${formatIsoDate(curriculumMeta.consultedAt)} · oferta y requisitos finales en el SIA</span><div><button class="text-button" data-action="import">Importar avance</button><button class="text-button" data-view="info">Fuentes y alcance</button><button class="text-button" data-action="reset">Reiniciar</button></div></footer>
  `
}

function pendingProfileItems() {
  const state = store.state
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
  const blocksCalculus = store.state.mathBasics === 'sin-definir'
  return `<section class="profile-notice" aria-labelledby="profile-notice-title"><div><strong id="profile-notice-title">Configura tu situación para empezar</strong><p>Falta indicar ${pending.join(', ')}.${blocksCalculus ? ' Mientras no indiques tu situación en Matemáticas básicas, Cálculo diferencial y las materias que dependen de ella aparecerán bloqueadas.' : ''} La aplicación no asume condiciones personales por defecto.</p></div><button class="button button-solid" type="button" data-action="configure-profile">Configurar ahora ${icon('arrow')}</button></section>`
}

function renderCreditBalance() {
  const balance = recordBalance(store.state)
  const freeRequired = balance.rows.find(row => row.category === 'LIBRE ELECCIÓN')?.required ?? 0
  return `<details class="curriculum-support credit-balance" data-panel="balance"${store.openPanels.has('balance') ? ' open' : ''}><summary>Balance de créditos <span>Requisitos por componente · ${balance.required} créditos</span></summary>
    <p>Estimación por componente, no certificación de grado. Las agrupaciones de optativas aún necesitan validación; los excedentes no pasan automáticamente a libre elección.</p>
    <div class="credit-balance-table"><table><caption>Créditos registrados y exigidos</caption><thead><tr><th scope="col">Componente</th><th scope="col">Registrados</th><th scope="col">Exigidos</th><th scope="col">Faltantes estimados</th></tr></thead><tbody>${balance.rows.map(row => `<tr><th scope="row">${row.category}</th><td>${row.recorded}</td><td>${row.required}</td><td>${row.remaining}</td></tr>`).join('')}</tbody></table></div>
    <p>Trabajo de grado aporta como máximo 6 créditos al balance, aunque registres ambas alternativas. Libre elección aporta como máximo ${freeRequired} créditos registrados. La nivelación es individual y no se suma a los ${totalCredits} créditos.</p>
    <p>El mapa muestra ${referenceFreeSlotCount} espacios de libre elección como guía visual. Con materias de 3 créditos suman ${referenceFreeSlotCount * 3}${referenceFreeSlotCount * 3 < freeRequired ? `, por debajo de los ${freeRequired} exigidos: planea al menos ${freeRequired - referenceFreeSlotCount * 3} crédito${freeRequired - referenceFreeSlotCount * 3 === 1 ? '' : 's'} más` : ''}.</p>
    <p>Fuente: resumen SIA del plan ${curriculumMeta.plan}, consulta del ${formatIsoDate(curriculumMeta.consultedAt)}. No se importó progreso personal.</p></details>`
}

function boardOptions(): BoardOptions {
  const state = store.state
  return {
    status: getStatus,
    missing: getMissingRequirements,
    approved: isApproved,
    note: (id) => state.notes[id],
    inspectId: store.pendingCourseId,
    electiveAssignments: state.electiveAssignments,
    freeChoices: state.freeChoice,
    assignElective: (key, id) => {
      const next = { ...state.electiveAssignments }
      if (id) next[key] = id
      else delete next[key]
      state.electiveAssignments = readElectiveAssignments(next, state.freeChoice)
      commit()
      document.querySelector<HTMLButtonElement>(`[data-slot-key="${key}"]`)?.focus({ preventScroll: true })
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
      store.pendingCourseId = subject.id
      commit()
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
      store.pendingCourseId = subject.id
      commit()
      if (inconsistentDependents.length) showToast('Revisa el historial', `${inconsistentDependents.length} materia${inconsistentDependents.length === 1 ? '' : 's'} aprobada${inconsistentDependents.length === 1 ? '' : 's'} quedó con requisitos pendientes.`)
    },
    planned: (id) => state.plan.includes(id),
    togglePlan: (subject) => {
      const adding = !state.plan.includes(subject.id)
      togglePlanned(subject.id)
      store.pendingCourseId = subject.id
      commit()
      showToast(adding ? 'Agregada al plan' : 'Quitada del plan', `${subject.name} · revisa la carga en Planear.`)
    },
    schedule: (subject) => {
      store.pendingScheduleSubjectId = subject.id
      store.editingSlotId = null
      navigate('horario')
    },
  }
}

function renderSupportTracks() {
  const state = store.state
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
        : statusInfo(status)
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
  return `<section class="support-tracks"><div class="support-intro"><span class="panel-kicker">Fuera de los ${totalCredits} créditos regulares</span><h2>Tu situación también importa.</h2><p>Las notas numéricas de Matemáticas Básicas y Lectoescritura afectan el promedio. Inglés acredita el requisito como aprobado o reprobado, sin nota numérica.</p></div><div class="support-grid">${track('nivelacion', 'Nivelación', `Son créditos adicionales: cuentan en el promedio cuando tienen nota, pero no dentro de los ${totalCredits} del plan.`)}${track('idioma', 'Lengua extranjera', 'La suficiencia acredita 12 créditos adicionales como aprobado, sin modificar el promedio.')}</div></section>`
}

/** Binds the map's own controls and mounts the interactive board; returns its disposer. */
export function bindMalla(root: HTMLElement) {
  const state = store.state
  root.querySelector<HTMLElement>('[data-action="configure-profile"]')?.addEventListener('click', () => {
    const support = root.querySelector<HTMLDetailsElement>('#support-tracks')
    if (!support) return
    support.open = true
    store.openPanels.add('support')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    support.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    support.querySelector<HTMLSelectElement>('select[data-profile]')?.focus({ preventScroll: true })
  })
  root.querySelectorAll<HTMLSelectElement>('[data-profile]').forEach((select) => select.addEventListener('change', () => {
    const key = select.dataset.profile as 'mathBasics' | 'literacy' | 'english'
    state[key] = select.value as RequirementStatus
    const subjectId = key === 'mathBasics' ? 'matematicas-basicas' : key === 'literacy' ? 'lecto-escritura' : undefined
    const grade = subjectId ? state.notes[subjectId] : undefined
    const contradictsGrade = subjectId !== undefined && grade !== undefined && (
      select.value === 'no-aplica' || select.value === 'sin-definir'
      || (select.value === 'pendiente' && grade >= 3)
      || (select.value === 'cumplida' && grade < 3))
    if (contradictsGrade) delete state.notes[subjectId]
    commit()
    if (contradictsGrade) showToast('Estado actualizado', 'Se quitó la nota anterior porque contradecía la nueva situación seleccionada.')
  }))
  root.querySelectorAll<HTMLButtonElement>('[data-support-id]').forEach((button) => button.addEventListener('click', () => {
    const support = supportSubjects.find((subject) => subject.id === button.dataset.supportId)
    if (!support) return
    const missing = support.prereqGroups?.filter((group) => !prerequisiteGroupSatisfied(state, group)).map(prerequisiteGroupLabel) ?? []
    if (missing.length) { showToast(`${support.name} sigue bloqueado`, `Primero completa ${missing.join(', ')}`); return }
    state.subjects[support.id] = state.subjects[support.id] === 'aprobada' ? 'pendiente' : 'aprobada'
    commit()
  }))
  const dispose = mountCurriculumBoard(root, boardOptions())
  store.pendingCourseId = undefined
  return dispose
}
