const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const { coursesBefore, parseState } = loadTs(() => ({ ...require('../src/views/onboarding.ts'), ...require('../src/domain/state.ts') }))

test('starting a semester marks only required courses drawn in earlier semesters', () => {
  assert.equal(coursesBefore(1).length, 0)
  const second = coursesBefore(2).map(subject => subject.code).sort()
  assert.deepEqual(second, ['1000004-B', '2015734', '2016502', '2016509'])
  assert.ok(coursesBefore(3).length > second.length)
  assert.ok(coursesBefore(10).every(subject => !subject.tipologia.includes('OPTATIVA')))
})

test('the guide is shown only to people without recorded progress', () => {
  assert.equal(parseState({}).onboarded, false)
  assert.equal(parseState({ onboarded: true }).onboarded, true)
  assert.equal(parseState({ subjects: { programacion: 'aprobada' } }).onboarded, true)
  assert.equal(parseState({ mathBasics: 'no-aplica' }).onboarded, true)
})

const { placeCard, tourSteps } = loadTs(() => require('../src/ui/tour.ts'))

test('the tour card sits below the highlighted element, or above it when there is no room', () => {
  const viewport = { width: 1440, height: 900 }
  const card = { width: 360, height: 240 }
  const below = placeCard({ top: 100, left: 600, width: 200, height: 60 }, card, viewport)
  assert.equal(below.top, 100 + 60 + 16)
  assert.equal(below.left, 600 + 100 - 180)
  const above = placeCard({ top: 700, left: 600, width: 200, height: 120 }, card, viewport)
  assert.equal(above.top, 700 - 16 - 240)
  // Near the edge it stays inside the viewport.
  assert.equal(placeCard({ top: 100, left: 1400, width: 40, height: 40 }, card, viewport).left, 1440 - 360 - 12)
  assert.equal(placeCard({ top: 100, left: 0, width: 40, height: 40 }, card, viewport).left, 12)
  // A target taller than the screen leaves the card at the bottom edge.
  assert.equal(placeCard({ top: 0, left: 0, width: 390, height: 780 }, { width: 366, height: 260 }, { width: 390, height: 780 }).top, 780 - 260 - 12)
})

test('every tour step explains something and points at the app', () => {
  assert.ok(tourSteps.length >= 6)
  for (const step of tourSteps) {
    assert.ok(step.title && step.body.length > 20)
    assert.ok(step.targets.length > 0)
  }
})
