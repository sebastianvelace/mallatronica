const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

const { buildTimetables } = loadTs(() => require('../src/domain/timetable.ts'))

const session = (day, start, end) => ({ day, start, end, place: '' })
const group = (activity, id, sessions, seats = 5) => ({ activity, group: id, seats, teacher: null, sessions })

const circuits = { id: 'c', name: 'Circuitos', groups: [
  group('MAGISTRAL', '1', [session('Lunes', '07:00', '09:00'), session('Miércoles', '07:00', '09:00')]),
  group('MAGISTRAL', '2', [session('Martes', '07:00', '09:00'), session('Jueves', '07:00', '09:00')]),
  group('LABORATORIO', '1', [session('Lunes', '09:00', '11:00')]),
  group('LABORATORIO', '2', [session('Viernes', '14:00', '16:00')]),
] }
const control = { id: 'k', name: 'Control', groups: [
  group('TEORICA', '1', [session('Lunes', '07:00', '09:00'), session('Miércoles', '07:00', '09:00')]),
  group('TEORICA', '2', [session('Lunes', '11:00', '13:00'), session('Miércoles', '11:00', '13:00')]),
] }

test('one group per activity, without overlaps', () => {
  const { options, missing } = buildTimetables([circuits, control])
  assert.deepEqual(missing, [])
  assert.ok(options.length > 0)
  for (const option of options) {
    const activities = option.picks.map(pick => `${pick.courseId}:${pick.group.activity}`)
    assert.equal(new Set(activities).size, 3)
    assert.equal(activities.length, 3)
  }
  // Circuitos M1 and Control T1 share Monday/Wednesday 07:00.
  assert.ok(!options.some(option => option.picks.some(p => p.courseId === 'c' && p.group.group === '1' && p.group.activity === 'MAGISTRAL') && option.picks.some(p => p.courseId === 'k' && p.group.group === '1')))
})

test('best option uses fewer days, then fewer gaps', () => {
  const [best] = buildTimetables([circuits, control]).options
  // M1 Mon/Wed + Lab1 Mon 09-11 + Control T2 Mon/Wed 11-13: two days; Wednesday idles 09-11.
  assert.equal(best.days, 2)
  assert.equal(best.gapMinutes, 120)
  assert.deepEqual(best.picks.map(pick => `${pick.courseId}${pick.group.activity[0]}${pick.group.group}`).sort(), ['cL1', 'cM1', 'kT2'])
})

test('fixed blocks and full groups are avoided; impossible activities are reported', () => {
  const fixed = [{ day: 'Lunes', start: '09:00', end: '11:00' }]
  const withFixed = buildTimetables([circuits], fixed).options
  assert.ok(withFixed.every(option => !option.picks.some(pick => pick.group.activity === 'LABORATORIO' && pick.group.group === '1')))
  const full = { id: 'f', name: 'Llena', groups: [group('TEORICA', '1', [session('Martes', '09:00', '11:00')], 0)] }
  assert.deepEqual(buildTimetables([full]).missing, [{ courseId: 'f', courseName: 'Llena', activity: 'TEORICA' }])
  assert.equal(buildTimetables([full], [], { requireSeats: false }).options.length, 1)
})

test('groups outside the board are not proposed and the search is bounded', () => {
  const sunday = { id: 's', name: 'Domingo', groups: [group('T', '1', [session('Domingo', '08:00', '10:00')])] }
  assert.equal(buildTimetables([sunday]).missing.length, 1)
  const many = Array.from({ length: 6 }, (_, c) => ({ id: `m${c}`, name: `M${c}`, groups: Array.from({ length: 30 }, (_, g) => group('T', String(g), [session(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][g % 6], `${String(7 + (g % 7) * 2).padStart(2, '0')}:00`, `${String(8 + (g % 7) * 2).padStart(2, '0')}:00`)])) }))
  const result = buildTimetables(many, [], { maxNodes: 2000 })
  assert.ok(result.options.length <= 5)
  assert.equal(result.truncated, true)
})
