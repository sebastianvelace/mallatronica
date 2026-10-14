const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const ts = require('typescript')

// Compile the actual domain modules with the existing TypeScript dependency.
// No browser or additional test framework is needed for these pure contracts.
const previous = require.extensions['.ts']
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  })
  module._compile(outputText, filename)
}
const { recordedAverage, readGrades } = require('../src/domain/grades.ts')
const { readElectiveAssignments, referenceSlot } = require('../src/domain/electives.ts')
const { subjects } = require('../src/data/curriculum.ts')
const { creditBalance } = require('../src/domain/credit-balance.ts')
const { mergeCatalogCourses, readCatalogCourses } = require('../src/domain/catalog.ts')
const { referenceSemesterForCode } = require('../src/data/reference-layout.ts')
if (previous) require.extensions['.ts'] = previous
else delete require.extensions['.ts']

test('plan requirements sum to 172 and exclude individual levelation', () => {
  const balance = creditBalance([])
  assert.equal(balance.required, 172)
  assert.equal(balance.allocated, 0)
  assert.deepEqual(balance.rows.map(row => row.required).sort((a,b) => a-b), [6,9,9,34,51,63])
})

test('degree alternatives and elective excess do not inflate progress', () => {
  const balance = creditBalance(subjects.map(subject => subject.id))
  const degree = balance.rows.find(row => row.category === 'TRABAJO DE GRADO')
  assert.equal(degree.recorded, 12)
  assert.equal(degree.allocated, 6)
  assert.equal(balance.allocated, 138)
  assert.equal(balance.rows.find(row => row.category === 'LIBRE ELECCIÓN').remaining, 34)
})

test('duplicate approvals and unknown ids do not add credits', () => {
  assert.equal(creditBalance(['calculo-diferencial','calculo-diferencial','unknown','matematicas-basicas']).allocated, 4)
})

test('free-choice progress is capped at its 34-credit requirement', () => {
  assert.equal(creditBalance([], 18).allocated, 18)
  assert.equal(creditBalance([], 40).allocated, 34)
})

test('an approval without a grade is not a zero in the average', () => {
  assert.deepEqual(recordedAverage({}), { value: null, credits: 0, courses: 0 })
  assert.equal(recordedAverage({ 'calculo-diferencial': 4.2 }).value, 4.2)
})

test('average is credit-weighted and includes failing grades', () => {
  const result = recordedAverage({ 'calculo-diferencial': 4.2, programacion: 3.6, 'intro-electronica': 2 })
  assert.equal(result.credits, 12)
  assert.equal(result.courses, 3)
  assert.ok(Math.abs(result.value - (4.2 * 4 + 3.6 * 3 + 2 * 5) / 12) < 1e-12)
})

test('recorded average includes local free-choice grades without mixing identifiers', () => {
  const free = [{ id: 'art', credits: 3 }]
  const result = recordedAverage({ programacion: 4.0, art: 1.0 }, free, { art: 5.0 })
  assert.equal(result.value, 4.5)
  assert.equal(result.credits, 6)
  assert.equal(result.courses, 2)
})

test('numeric math and literacy levelation affect the average, while language AP/RE does not', () => {
  const result = recordedAverage({ programacion: 0, 'matematicas-basicas': 5, 'lecto-escritura': 4, 'ingles-1': 1, unknown: 5 })
  assert.deepEqual(result, { value: 36 / 11, credits: 11, courses: 3 })
})

test('imported grades reject non-numeric and out-of-range data', () => {
  assert.deepEqual(readGrades({ a: '4.2', b: null, c: NaN, d: Infinity, e: -1, f: 6, g: 4.2, h: 0, i: 4.26 }), { g: 4.2, h: 0, i: 4.3 })
  for (const value of [null, [], '4']) assert.deepEqual(readGrades(value), {})
})

test('an elective is placed once and cannot cross components', () => {
  const probability = subjects.find((subject) => subject.code === '1000013-B').id
  assert.deepEqual(readElectiveAssignments({ '5:1': probability, '8:1': probability, '6:4': probability }, []), { '5:1': probability })
  assert.deepEqual(readElectiveAssignments({ '6:4': probability }, []), {})
})

test('reference placements reject required cells and malformed coordinates', () => {
  assert.equal(referenceSlot('1:1'), undefined)
  assert.equal(referenceSlot('05:1'), undefined)
  assert.equal(referenceSlot('5:1:extra'), undefined)
  assert.equal(referenceSlot('5:1').kind, 'foundation')
})

test('free-choice placements need an existing course and cannot duplicate a catalogue course', () => {
  const free = { id: 'art', code: 'TEST123', name: 'Arte', credits: 3, category: 'Libre elección' }
  assert.deepEqual(readElectiveAssignments({ '1:2': 'art', '2:5': 'art' }, [free]), { '1:2': 'art' })
  assert.deepEqual(readElectiveAssignments({ '1:2': 'art' }, []), {})
  assert.deepEqual(readElectiveAssignments({ '1:2': 'art' }, [{ ...free, code: '1000004-B' }]), {})
})

test('two local free-choice records with the same code cannot fill two slots', () => {
  const free = { id: 'a', code: 'ABC-123', name: 'Arte', credits: 3, category: 'Libre elección' }
  assert.deepEqual(readElectiveAssignments({ '1:2': 'a', '2:5': 'b' }, [free, { ...free, id: 'b', code: 'abc123' }]), { '1:2': 'a' })
})

test('catalog import rejects duplicate codes and identifiers', () => {
  const courses = readCatalogCourses([
    { id: 'one', code: 'ABC-123', name: 'One', credits: 3, category: 'Libre' },
    { id: 'two', code: 'abc123', name: 'Duplicate code', credits: 3, category: 'Libre' },
    { id: 'one', code: 'XYZ', name: 'Duplicate id', credits: 3, category: 'Libre' },
  ])
  assert.deepEqual(courses.map(course => course.name), ['One'])
})

test('catalog import merges without overwriting manual records', () => {
  const manual = [{ id: 'manual-a', code: 'ABC-123', name: 'Manual', credits: 3, category: 'Libre', source: 'manual' }]
  const imported = [
    { id: 'import-a', code: 'abc123', name: 'Duplicate', credits: 4, category: 'Otra', source: 'imported' },
    { id: 'import-b', code: 'XYZ-9', name: 'New', credits: 2, category: 'Libre', source: 'imported' },
  ]
  const result = mergeCatalogCourses(manual, imported)
  assert.deepEqual(result.courses.map(course => course.name), ['Manual', 'New'])
  assert.equal(result.added, 1)
  assert.equal(result.skipped, 1)
})

test('calculator grouping follows the visual reference without claiming SIA semesters', () => {
  assert.equal(referenceSemesterForCode('1000004-B'), 1)
  assert.equal(referenceSemesterForCode('2028816'), 10)
  assert.equal(referenceSemesterForCode('unknown'), null)
})

test('critical global requirements are represented conservatively', () => {
  const design = subjects.find(subject => subject.code === '2028816')
  const workshop = subjects.find(subject => subject.code === '2024045')
  const degree = subjects.find(subject => subject.code === '2015316')
  assert.deepEqual(design.globalPrereqs?.map(item => [item.kind, item.value]), [['recordedRegularCredits', 138]])
  assert.deepEqual(workshop.globalPrereqs?.map(item => [item.kind, item.value]), [['regularCredits', 121]])
  assert.deepEqual(degree.globalPrereqs?.map(item => [item.kind, item.value]), [['disciplinaryCredits', 63]])
})
