const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const { courseStatus, missingRequirements, isApproved, approvedCredits, subjects, parseState, emptyState, normalizeCatalogCourse } = loadTs(() => ({
  ...require('../src/domain/progress.ts'),
  ...require('../src/domain/state.ts'),
  ...require('../src/domain/catalog.ts'),
  ...require('../src/data/curriculum.ts'),
}))

const byCode = (code) => subjects.find(subject => subject.code === code)
const record = (overrides = {}) => ({ ...emptyState(), mathBasics: 'no-aplica', ...overrides })

test('Circuitos II is partial with Circuitos I only and available once Ecuaciones Diferenciales is approved', () => {
  const circuits2 = byCode('2016490')
  assert.equal(courseStatus(record({ subjects: { 'circuitos-1': 'aprobada' } }), circuits2), 'parcial')
  // Matemáticas IV is an OR alternative and is not required.
  assert.equal(courseStatus(record({ subjects: { 'circuitos-1': 'aprobada', ecuaciones: 'aprobada' } }), circuits2), 'disponible')
})

test('a course with no approved prerequisite is blocked', () => {
  assert.equal(courseStatus(record(), byCode('2016490')), 'bloqueada')
})

test('an unconfigured Mathematics Basics situation blocks Cálculo diferencial with an actionable message', () => {
  const calculus = byCode('1000004-B')
  const fresh = emptyState()
  assert.equal(courseStatus(fresh, calculus), 'bloqueada')
  assert.deepEqual(missingRequirements(fresh, calculus), ['Configurar situación de Matemáticas básicas'])
  assert.deepEqual(missingRequirements({ ...fresh, mathBasics: 'pendiente' }, calculus), ['Matemáticas básicas'])
  assert.equal(courseStatus({ ...fresh, mathBasics: 'no-aplica' }, calculus), 'disponible')
  assert.equal(courseStatus({ ...fresh, mathBasics: 'pendiente', notes: { 'matematicas-basicas': 3.5 } }, calculus), 'disponible')
})

test('a saved grade takes precedence over a manual mark', () => {
  const programming = byCode('2015734')
  const state = record({ subjects: { programacion: 'aprobada' }, notes: { programacion: 2.5 } })
  assert.equal(isApproved(state, programming), false)
  assert.equal(courseStatus(state, programming), 'reprobada')
})

test('global credit requirements report current progress', () => {
  const workshop = byCode('2024045')
  const missing = missingRequirements(record(), workshop)
  assert.equal(missing.length, 1)
  assert.match(missing[0], /70% del plan aprobado.*\(llevas 0\)/)
})

test('approved free-choice credits count toward plan progress, capped at 34', () => {
  const course = (id) => ({ id, code: id.toUpperCase(), name: id, credits: 12, category: 'LE', source: 'manual' })
  const freeChoice = ['free-a', 'free-b', 'free-c'].map(course)
  const state = record({ freeChoice, freeChoiceStatus: { 'free-a': 'aprobada', 'free-b': 'aprobada', 'free-c': 'aprobada' } })
  assert.equal(approvedCredits(state), 34)
})

test('invalid stored data falls back to an empty state with the system theme', () => {
  for (const value of [null, [], 'x', 4]) assert.deepEqual(parseState(value, 'dark'), emptyState('dark'))
  assert.equal(parseState({ schemaVersion: 4, theme: 'dark' }, 'light').theme, 'light')
  assert.equal(parseState({ schemaVersion: 7, theme: 'dark' }, 'light').theme, 'dark')
  assert.equal(parseState({}, 'dark').theme, 'dark')
})

test('parsed state drops manual marks contradicted by grades and orphaned free-choice progress', () => {
  const state = parseState({
    subjects: { programacion: 'aprobada', ecuaciones: 'aprobada' },
    notes: { programacion: 4 },
    freeChoice: [{ id: 'free-a', code: 'A1', name: 'A', credits: 3, category: 'LE', source: 'manual' }],
    freeChoiceStatus: { 'free-a': 'aprobada', 'free-gone': 'aprobada' },
    freeChoiceNotes: { 'free-gone': 4 },
  })
  assert.deepEqual(state.subjects, { ecuaciones: 'aprobada' })
  assert.deepEqual(state.freeChoiceStatus, { 'free-a': 'aprobada' })
  assert.deepEqual(state.freeChoiceNotes, {})
})

test('stored free-choice courses cannot reuse a plan id, and SIA-sourced courses survive reloads', () => {
  const state = parseState({ subjects: {}, freeChoice: [
    { id: 'programacion', code: 'X1', name: 'Collision', credits: 3, category: 'LE', source: 'imported' },
    { id: 'free-sia', code: 'X2', name: 'From SIA', credits: 3, category: 'LE', source: 'sia-public' },
  ] })
  assert.deepEqual(state.freeChoice.map(course => course.id), ['free-sia'])
})

test('imported catalog ids are namespaced away from plan ids', () => {
  assert.equal(normalizeCatalogCourse({ id: 'programacion', code: 'X1', name: 'A', credits: 3, category: 'LE' }, 0, 'imported').id, 'free-programacion')
  assert.equal(normalizeCatalogCourse({ id: 'free-keep', code: 'X1', name: 'A', credits: 3, category: 'LE' }, 0, 'imported').id, 'free-keep')
  assert.equal(normalizeCatalogCourse({ code: 'AB-1', name: 'A', credits: 3, category: 'LE' }, 2, 'manual').id, 'free-ab-1-2')
})
