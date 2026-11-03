const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const loadTs = require('./load-ts.cjs')

const { hasSavedProgress, describeStatus, formatUpdated, STATE_KEY } = loadTs(() => require('../src/landing/logic.ts'))
const { viewFromHash } = loadTs(() => require('../src/app/store.ts'))
const graph = require('../src/landing/graph.json')
const plan = require('../data/sia/plan2545.json')
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')

const storage = (value) => ({ getItem: (key) => (key === STATE_KEY ? value : null) })

test('the hero offers to continue only when this browser holds real progress', () => {
  assert.equal(hasSavedProgress(undefined), false)
  assert.equal(hasSavedProgress(storage(null)), false)
  assert.equal(hasSavedProgress(storage('{not json')), false)
  assert.equal(hasSavedProgress(storage(JSON.stringify({ onboarded: false, subjects: {} }))), false)
  assert.equal(hasSavedProgress(storage(JSON.stringify({ onboarded: true, subjects: {} }))), true)
  assert.equal(hasSavedProgress(storage(JSON.stringify({ subjects: { calculo: 'aprobada' } }))), true)
  assert.equal(hasSavedProgress({ getItem: () => { throw new Error('blocked') } }), false)
})

test('the live badge shows only published refreshes, in Bogotá time', () => {
  const now = new Date('2026-11-03T20:00:00Z')
  assert.equal(describeStatus(null, now), null)
  assert.equal(describeStatus({ finishedAt: '2026-11-03T11:20:00Z', published: false }, now), null)
  const summary = describeStatus({ finishedAt: '2026-11-03T11:20:00Z', published: true, job: { courses: 62 }, offer: { courses: 62, groups: 630 } }, now)
  assert.match(summary.badge, /^Oferta del SIA actualizada hoy, 6:20/)
  assert.match(summary.badge, /62 asignaturas · 630 grupos$/)
  assert.match(summary.updated, /^Hoy, /)
  assert.match(formatUpdated('2026-11-02T11:20:00Z', now), /^ayer, /)
  assert.doesNotMatch(formatUpdated('2026-10-20T11:20:00Z', now), /hoy|ayer/)
  // An old status without the offer block still reports its course count.
  assert.match(describeStatus({ finishedAt: '2026-11-03T11:20:00Z', published: true, job: { courses: 60 } }, now).badge, /60 asignaturas$/)
})

test('the constellation is the real prerequisite network of the plan', () => {
  const courses = plan.filter((course) => !course.tipologia.startsWith('NIVELACI'))
  assert.equal(graph.nodes.length, courses.length)
  for (const [x, y] of graph.nodes) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1)
  for (const [from, to] of graph.edges) {
    const prerequisite = courses[from].codigo
    assert.ok(courses[to].prerrequisitos.some((item) => item.codigo === prerequisite), `${courses[to].nombre} requires ${courses[from].nombre}`)
  }
  assert.ok(graph.names.length > 20)
})

test('deep links open the named view and ignore anything else', () => {
  assert.equal(viewFromHash('#horario'), 'horario')
  assert.equal(viewFromHash('#calculadora'), 'calculadora')
  assert.equal(viewFromHash('#nada'), null)
  assert.equal(viewFromHash(''), null)
})

test('every landing link into the app targets a real view', () => {
  const links = [...html.matchAll(/href="\/app(#[a-z]+)?"/g)].map((match) => match[1])
  assert.ok(links.length >= 5)
  for (const hash of links) if (hash) assert.ok(viewFromHash(hash), hash)
  assert.match(html, /Las 46 asignaturas/)
  assert.equal((plan.filter((course) => !course.tipologia.startsWith('NIVELACI'))).length, 46)
})
