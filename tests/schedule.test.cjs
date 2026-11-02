const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const { findConflict, validateSlot, upsertSlot, slotColor, scheduleAsText, SLOT_COLORS } = loadTs(() => require('../src/domain/schedule.ts'))

const slot = (overrides = {}) => ({ id: 'a', subjectId: 'programacion', day: 'Lunes', start: '07:00', end: '09:00', group: '', room: '', ...overrides })

test('overlapping blocks on the same day conflict; touching or other-day blocks do not', () => {
  const existing = [slot()]
  assert.equal(findConflict(existing, slot({ id: 'b', start: '08:00', end: '10:00' }))?.id, 'a')
  assert.equal(findConflict(existing, slot({ id: 'b', start: '09:00', end: '11:00' })), undefined)
  assert.equal(findConflict(existing, slot({ id: 'b', day: 'Martes' })), undefined)
})

test('an edited block does not conflict with its previous version', () => {
  assert.equal(validateSlot([slot()], slot({ start: '07:30', end: '09:30' })), null)
})

test('invalid blocks report the specific problem', () => {
  assert.equal(validateSlot([], slot({ subjectId: '' })), 'incomplete')
  assert.equal(validateSlot([], slot({ start: '7:00' })), 'incomplete')
  assert.equal(validateSlot([], slot({ day: 'Domingo' })), 'incomplete')
  assert.equal(validateSlot([], slot({ start: '09:00', end: '09:00' })), 'order')
  assert.equal(validateSlot([], slot({ start: '06:00', end: '08:00' })), 'range')
  assert.equal(validateSlot([], slot({ start: '20:00', end: '22:00' })), 'range')
  assert.equal(validateSlot([slot()], slot({ id: 'b', start: '08:00', end: '10:00' })), 'conflict')
})

test('upsert replaces by id and appends new blocks', () => {
  const edited = upsertSlot([slot(), slot({ id: 'b', day: 'Martes' })], slot({ room: '401' }))
  assert.deepEqual(edited.map(item => [item.id, item.room]), [['a', '401'], ['b', '']])
  assert.equal(upsertSlot([slot()], slot({ id: 'c' })).length, 2)
})

test('every block of a course gets the same color within the palette', () => {
  assert.equal(slotColor('programacion'), slotColor('programacion'))
  for (const id of ['a', 'calculo-diferencial', 'free-x', '']) {
    const color = slotColor(id)
    assert.ok(Number.isInteger(color) && color >= 0 && color < SLOT_COLORS)
  }
})

test('text export lists every day in order with details', () => {
  const text = scheduleAsText([slot({ start: '10:00', end: '12:00', group: '2', room: '401' }), slot({ id: 'b' })], () => 'Programación')
  const lines = text.split('\n')
  assert.equal(lines[0], 'Lunes:')
  assert.equal(lines[1], '  07:00-09:00 · Programación')
  assert.equal(lines[2], '  10:00-12:00 · Programación · grupo 2 · 401')
  assert.equal(lines.at(-1), 'Sábado: sin bloques')
})
