const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const snapshot = JSON.parse(readFileSync(join(__dirname, '../data/sia/snapshots/latest.json'), 'utf8'))
const plan = JSON.parse(readFileSync(join(__dirname, '../data/sia/plan2545.json'), 'utf8'))
const planByCode = new Map(plan.map(course => [course.codigo, course]))
const prereqKey = (items) => (items ?? []).map(item => `${item.condicion}:${item.codigo}:${item.todas}`).sort()

test('snapshot comes from the public SIA search for plan 2545', () => {
  assert.match(snapshot.fuente.url, /^https:\/\/sia\.unal\.edu\.co\//)
  assert.match(snapshot.fuente.filtros.plan, /^2545 /)
  assert.ok(!Number.isNaN(Date.parse(snapshot.fuente.consultado)))
  assert.ok(snapshot.asignaturas.length >= 50)
})

test('the app plan matches the SIA snapshot: same courses, credits, typologies and offer flag', () => {
  assert.deepEqual([...planByCode.keys()].sort(), snapshot.asignaturas.map(course => course.codigo).sort())
  for (const course of snapshot.asignaturas) {
    const local = planByCode.get(course.codigo)
    assert.equal(local.creditos, course.creditos, `${course.codigo} créditos`)
    assert.equal(local.tipologia, course.tipologia, `${course.codigo} tipología`)
    assert.equal(local.sin_programar_2026_2, course.sin_programar, `${course.codigo} sin programar`)
  }
})

test('prerequisites read from the SIA detail match the app plan', () => {
  for (const course of snapshot.asignaturas) {
    if (!course.actividades || course.detalle_no_disponible) continue
    assert.deepEqual(prereqKey(planByCode.get(course.codigo).prerrequisitos), prereqKey(course.prerrequisitos), course.codigo)
  }
})

test('every scheduled group has well-formed sessions and seats', () => {
  for (const course of snapshot.asignaturas) {
    for (const activity of course.actividades ?? []) {
      for (const group of activity.grupos) {
        assert.ok(Number.isInteger(group.cupos_disponibles) && group.cupos_disponibles >= 0, `${course.codigo} G${group.grupo}`)
        for (const session of group.sesiones) {
          assert.match(session.inicio, /^\d{2}:\d{2}$/)
          assert.match(session.fin, /^\d{2}:\d{2}$/)
          assert.ok(session.inicio < session.fin, `${course.codigo} ${session.dia}`)
        }
      }
    }
  }
})
