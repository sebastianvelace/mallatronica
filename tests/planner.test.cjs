const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const { descendantsOf, planSuggestions, simulatePlan, unlockedByPlan, planItems, plannedCredits, canTake, emptyState, parseState, subjects } = loadTs(() => ({
  ...require('../src/domain/planner.ts'),
  ...require('../src/domain/state.ts'),
  ...require('../src/data/curriculum.ts'),
}))

const byId = (id) => subjects.find(subject => subject.id === id)
const record = (overrides = {}) => ({ ...emptyState(), mathBasics: 'no-aplica', ...overrides })

test('descendants follow prerequisite links transitively', () => {
  const circuits1 = descendantsOf(byId('circuitos-1'))
  assert.ok(circuits1.has('circuitos-2'))
  assert.ok(circuits1.has('electronica-analoga-1'))
  assert.ok(circuits1.has('electronica-digital-1'), 'reached through Electrónica análoga I')
  assert.equal(circuits1.has('circuitos-1'), false)
  assert.equal(descendantsOf(byId('trabajo-grado')).size, 0)
})

test('suggestions only list takeable courses, ranked by the paths they open', () => {
  const suggestions = planSuggestions(record(), [])
  assert.ok(suggestions.length > 0)
  for (const { subject } of suggestions) assert.ok(canTake(record(), subject), subject.name)
  for (let i = 1; i < suggestions.length; i++) assert.ok(suggestions[i - 1].opens >= suggestions[i].opens)
  assert.equal(suggestions[0].subject.id, 'calculo-diferencial')
})

test('planned and approved courses are not suggested; a failed course is', () => {
  const state = record({ subjects: { 'intro-electronica': 'aprobada' }, notes: { programacion: 2.1 } })
  const ids = planSuggestions(state, ['calculo-diferencial']).map(item => item.subject.id)
  assert.equal(ids.includes('calculo-diferencial'), false)
  assert.equal(ids.includes('intro-electronica'), false)
  assert.ok(ids.includes('programacion'))
})

test('simulating a plan does not modify the real record', () => {
  const state = record({ notes: { programacion: 2.1 } })
  const after = simulatePlan(state, ['programacion', 'calculo-diferencial'])
  assert.deepEqual(state.notes, { programacion: 2.1 })
  assert.deepEqual(state.subjects, {})
  assert.equal(after.subjects.programacion, 'aprobada')
  assert.equal(after.notes.programacion, undefined)
})

test('the plan reports the courses it would unlock', () => {
  const unlocked = unlockedByPlan(record(), ['calculo-diferencial']).map(subject => subject.id)
  assert.ok(unlocked.includes('calculo-integral'))
  assert.ok(unlocked.includes('algebra-lineal'))
  assert.equal(unlocked.includes('calculo-diferencial'), false)
  // Circuitos II needs Circuitos I and Ecuaciones (or Matemáticas IV): one is not enough.
  const partial = record({ subjects: { 'circuitos-1': 'aprobada' } })
  assert.equal(unlockedByPlan(partial, []).length, 0)
})

test('plan items flag approved and blocked courses and count only pending credits', () => {
  const free = [{ id: 'free-a', code: 'A1', name: 'Arte', credits: 2, category: 'LE', source: 'manual' }]
  const state = record({ subjects: { programacion: 'aprobada' }, freeChoice: free })
  const items = planItems(state, ['programacion', 'circuitos-2', 'calculo-diferencial', 'free-a', 'missing'])
  assert.deepEqual(items.map(item => [item.id, item.state]), [
    ['programacion', 'approved'], ['circuitos-2', 'blocked'], ['calculo-diferencial', 'ready'], ['free-a', 'ready'],
  ])
  assert.equal(plannedCredits(items), 4 + 4 + 2)
})

test('stored plans keep known ids once and drop removed free-choice courses', () => {
  const free = [{ id: 'free-a', code: 'A1', name: 'Arte', credits: 2, category: 'LE', source: 'manual' }]
  assert.deepEqual(parseState({ plan: ['programacion', 'programacion', 'nope', 'free-a', 4], freeChoice: free }).plan, ['programacion', 'free-a'])
  assert.deepEqual(parseState({ plan: ['free-a'] }).plan, [])
})
