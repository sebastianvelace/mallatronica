const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const { groupings, groupingFor, groupingBalance, readGroupingChoices, emptyState, parseState, subjects } = loadTs(() => ({
  ...require('../src/domain/groupings.ts'),
  ...require('../src/domain/state.ts'),
  ...require('../src/data/curriculum.ts'),
}))

const byCode = (code) => subjects.find(subject => subject.code === code)

test('official groupings add up to the optional credits of each component', () => {
  const sum = (component) => groupings.filter(item => item.componente === component).reduce((total, item) => total + item.creditos_optativos, 0)
  assert.equal(sum('FUND. OPTATIVA'), 9)
  assert.equal(sum('DISCIPLINAR OPTATIVA'), 9)
})

test('every elective of the plan has an inferred grouping of its own component', () => {
  for (const subject of subjects.filter(item => item.tipologia.includes('OPTATIVA'))) {
    const info = groupingFor(subject)
    assert.ok(info, subject.name)
    assert.ok(subject.tipologia.startsWith(info.grouping.componente), subject.name)
    assert.notEqual(info.source, 'confirmada')
  }
})

test('a confirmation from the student overrides the inference, within the component only', () => {
  const rf = byCode('2016488')
  assert.equal(groupingFor(rf).source, 'ambigua')
  assert.equal(groupingFor(rf, { [rf.id]: 'analoga' }).grouping.id, 'analoga')
  assert.equal(groupingFor(rf, { [rf.id]: 'analoga' }).source, 'confirmada')
  assert.equal(groupingFor(rf, { [rf.id]: 'economicas' }).source, 'ambigua')
  assert.deepEqual(readGroupingChoices({ [rf.id]: 'analoga', programacion: 'digital', nope: 'digital', [byCode('1000013-B').id]: 'digital' }), { [rf.id]: 'analoga' })
})

test('grouping balance counts approved electives and flags inferred memberships', () => {
  const embedded = byCode('2016508')
  const record = { ...emptyState(), subjects: { [embedded.id]: 'aprobada' } }
  const digital = groupingBalance(record).find(row => row.id === 'digital')
  assert.equal(digital.approved, 3)
  assert.equal(digital.remaining, 0)
  assert.equal(digital.uncertain, true)
  assert.equal(groupingBalance(record, { [embedded.id]: 'digital' }).find(row => row.id === 'digital').uncertain, false)
})

test('stored grouping confirmations survive parsing', () => {
  const rf = byCode('2016488')
  assert.deepEqual(parseState({ groupings: { [rf.id]: 'analoga', programacion: 'x' } }).groupings, { [rf.id]: 'analoga' })
})
