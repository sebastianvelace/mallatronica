const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./load-ts.cjs')

// Synthetic pages reproducing the formats seen in the public SIA search (November 2026), with invented names.
const { parseDetail, parseResults, resultLinks, unescapeHtml, place, validateSnapshot, planEntries, newJob, jobDone } = loadTs(() => ({
  ...require('../src/sia/parse.ts'),
  ...require('../src/sia/job.ts'),
}))

const PREREQS = '<span>Prerrequisitos</span><span>Condición 1</span> <span>Tipo M</span> <span>¿Todas? [N]</span> <span>Número asignaturas [1]</span> <span>1000004-B Cálculo diferencial</span> <span>2001285 Matematicas i</span> <span>Tipo de prerrequisito implica.</span>'
const page = (body) => `<html><body><script>var x = 1;</script>${body}</body></html>`

test('lecture and lab groups with sessions, rooms and seats', () => {
  const detail = parseDetail(page(
    '<h1>Curso de prueba (2016488)</h1> Tipología: DISCIPLINAR OPTATIVA Créditos: 3 Contenido de la asignatura '
    + 'CLASE MAGISTRAL (2016488) (1) Grupo 1 Profesor: Ana Prueba. Facultad: Horarios/Aula: No informado '
    + 'Fecha: 24/08/2026 <script>_dfs["a"]="dd/MM/yyyy";</script> - 12/12/2026 '
    + 'MI&Eacute;RCOLES de 09:00 a 11:00. SALON DE CLASE 453-417. 453-417. 453 - Edificio Uno. SALON. '
    + 'VIERNES de 09:00 a 11:00. SALÓN DE CLASE 401-305. 401-305. 401 - Edificio Dos. SALON. '
    + 'Duración: Semestral Jornada: DIURNO Cupos disponibles: 6 '
    + 'CLASE LABORATORIO (2016488) (1) Grupo 1 Profesor: Ana Prueba. Facultad: Horarios/Aula: No informado '
    + 'Fecha: 24/08/2026 - 12/12/2026 MARTES de 09:00 a 11:00. LABORATORIO X. 411-104A. 411 - Laboratorios. LABORATORIO. '
    + 'Duración: Semestral Jornada: DIURNO Cupos disponibles: 0 ' + PREREQS), '2016488')
  assert.deepEqual(detail.actividades.map(a => a.actividad), ['CLASE MAGISTRAL', 'CLASE LABORATORIO'])
  const lecture = detail.actividades[0].grupos[0]
  assert.equal(lecture.grupo, '1')
  assert.equal(lecture.profesor, 'Ana Prueba')
  assert.equal(lecture.cupos_disponibles, 6)
  assert.deepEqual(lecture.sesiones.map(s => [s.dia, s.inicio, s.fin, s.lugar]), [['MIÉRCOLES', '09:00', '11:00', '453-417 · Edificio Uno'], ['VIERNES', '09:00', '11:00', '401-305 · Edificio Dos']])
  assert.equal(detail.actividades[1].grupos[0].cupos_disponibles, 0)
  assert.deepEqual(detail.prerrequisitos.map(p => [p.codigo, p.condicion, p.todas]), [['1000004-B', 1, false], ['2001285', 1, false]])
})

test('pages without content heading, faculty prefix and PEAMA groups', () => {
  const detail = parseDetail(page(
    'Álgebra de prueba (1000003-B) Tipología: FUND. OBLIGATORIA Créditos: 4 INGENIERÍA Facultad: FACULTAD DE INGENIERÍA '
    + 'CLASE TEORICA 1000003 (21000003) (1) Grupo 1 Profesor: Luis Prueba. Facultad: FACULTAD DE CIENCIAS '
    + 'Horarios/Aula: No informado Fecha: 24/08/2026 - 17/12/2026 LUNES de 07:00 a 09:00. Duración: Semestral Jornada: DIURNO Cupos disponibles: 2 '
    + '(SUMA-01) Grupo 1 - PEAMA Sumapaz Profesor: Eva Prueba. Facultad: SEDE BOGOTÁ Horarios/Aula: No informado '
    + 'Fecha: 27/08/2026 - 16/12/2026 MIÉRCOLES de 08:00 a 12:00. Duración: Semestral Jornada: DIURNO Cupos disponibles: 0'), '1000003-B')
  assert.deepEqual(detail.actividades.map(a => a.actividad), ['CLASE TEORICA'])
  assert.deepEqual(detail.actividades[0].grupos.map(g => g.grupo), ['1', '1 - PEAMA Sumapaz'])
})

test('suffixed labels, spaced codes, unnamed groups and empty activities', () => {
  const detail = parseDetail(page(
    'Taller (2024045 ) Contenido de la asignatura CLASE PRACTICA-Programación de Prueba (2024045 ) '
    + '(1) 2024045-1 Taller de prueba Profesor: Eva Prueba. Facultad: FACULTAD DE INGENIERÍA Horarios/Aula: No informado '
    + 'Fecha: 27/08/2026 - 17/12/2026 LUNES de 14:00 a 16:00. Duración: Semestral Jornada: DIURNO Cupos disponibles: 9'), '2024045')
  assert.equal(detail.actividades[0].actividad, 'CLASE PRACTICA-Programación de Prueba')
  assert.equal(detail.actividades[0].grupos[0].grupo, '1')
  assert.equal(detail.actividades[0].grupos[0].cupos_disponibles, 9)
  const empty = parseDetail(page('Curso (2015701) Contenido de la asignatura CLASE PRACTICA (2015701) ' + PREREQS), '2015701')
  assert.deepEqual(empty.actividades, [])
  assert.equal(empty.prerrequisitos.length, 2)
})

test('result rows and detail links by course code', () => {
  const html = '<div id="pt1:r1:0:t4::db"><table>'
    + '<tr><td><a id="pt1:r1:0:t4:0:cl2" class="af_commandLink">2016488</a></td><td><span>Curso A</span></td><td>3</td><td>DISCIPLINAR OPTATIVA (T)</td><td></td></tr>'
    + '<tr><td><a id="pt1:r1:0:t4:1:cl2" class="af_commandLink">2015698</a></td><td><span>Curso B</span> ASIGNATURA SIN PROGRAMAR</td><td>3</td><td>FUND. OPTATIVA (O)</td><td></td></tr>'
    + '</table></div>'
  assert.deepEqual(parseResults(html).map(r => [r.codigo, r.nombre, r.creditos, r.sin_programar]), [['2016488', 'Curso A', 3, false], ['2015698', 'Curso B', 3, true]])
  assert.deepEqual(resultLinks(html), { 2016488: 'pt1:r1:0:t4:0:cl2', 2015698: 'pt1:r1:0:t4:1:cl2' })
})

test('entities and rooms', () => {
  assert.equal(unescapeHtml('BOGOT&Aacute; &iquest;S&iacute;? &amp; &#241; &#xF1;'), 'BOGOTÁ ¿Sí? & ñ ñ')
  assert.equal(place('SALA DE INFORMATICA 453-224. 453-224. 453 - Edificio. SALA DE INFORMATICA Y/O DE COMPUTO'), '453-224 · Edificio')
  assert.equal(place('Sin formato.'), 'Sin formato')
})

const course = (codigo, extra = {}) => ({ codigo, nombre: `Curso ${codigo}`, creditos: 3, tipologia: 'T', sin_programar: false, actividades: [], prerrequisitos: [], ...extra })

test('a snapshot is published only when complete and well formed', () => {
  const snapshot = (courses) => ({ fuente: { consultado: 'x' }, asignaturas: courses })
  const full = Array.from({ length: 60 }, (_, i) => course(String(1000000 + i)))
  assert.deepEqual(validateSnapshot(snapshot(full)), [])
  assert.match(validateSnapshot(snapshot(full.slice(0, 10)))[0], /Solo 10 asignaturas/)
  const unread = full.map((item, i) => i < 20 ? { ...item, detalle_no_disponible: true } : item)
  assert.ok(validateSnapshot(snapshot(unread)).some(problem => /con detalle/.test(problem)))
  const bad = [...full.slice(1), course('9999999', { actividades: [{ actividad: 'T', grupos: [{ cupos_disponibles: 1, sesiones: [{ inicio: '10:00', fin: '09:00' }] }] }] })]
  assert.ok(validateSnapshot(snapshot(bad)).some(problem => /sesión inválida/.test(problem)))
})

test('plan file keeps previous prerequisites when a detail was not read', () => {
  const previous = [{ codigo: 'X1', nombre: 'Old', creditos: 3, tipologia: 'T', agrupacion: null, prerrequisitos: [{ codigo: 'Y' }], semestre: null, sin_programar_2026_2: false }]
  const [entry] = planEntries({ asignaturas: [course('X1', { nombre: 'Nuevo', sin_programar: true, detalle_no_disponible: true, actividades: undefined })] }, previous)
  assert.equal(entry.nombre, 'Nuevo')
  assert.deepEqual(entry.prerrequisitos, [{ codigo: 'Y' }])
  assert.equal(entry.sin_programar_2026_2, true)
})

test('a new job starts at the first typology', () => {
  const job = newJob(new Date('2026-11-03T00:00:00Z'))
  assert.equal(job.index, 0)
  assert.equal(jobDone(job), false)
  assert.equal(jobDone({ ...job, index: job.typologies.length }), true)
})
