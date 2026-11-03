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
