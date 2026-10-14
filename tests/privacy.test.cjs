const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

test('public plan contains requirements, not individual progress', () => {
  const plan = JSON.parse(readFileSync(join(__dirname, '../data/sia/v2/estructura.json'), 'utf8'))
  for (const row of plan.resumen_creditos) {
    for (const key of ['aprobados', 'pendientes', 'inscritos', 'cursados']) assert.equal(key in row, false)
    assert.notEqual(row.tipologia, 'TOTAL ESTUDIANTE')
    assert.notEqual(row.tipologia, 'NIVELACIÓN')
  }
  assert.equal(plan.nivelacion.exigidos, null)
})

test('public evidence excludes personal progress and request records', () => {
  const evidence = readFileSync(join(__dirname, '../data/sia/v2/evidencia.md'), 'utf8')
  assert.doesNotMatch(evidence, /Porcentaje de Avance|Cupo de créditos|Créditos disponibles|TOTAL ESTUDIANTE|Mis solicitudes (no )?finalizadas|ESTADO ABIERTO|historia_academica_resumen_creditos|deben nivelar matemáticas/)
  for (const line of evidence.split('\n')) {
    if (line.includes('\t')) assert.equal(line.split('\t').length, 2)
  }
})
