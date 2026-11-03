#!/usr/bin/env node
// Local run of the same SIA job the Vercel cron executes (src/sia/job.ts), in one go.
// Writes the bundled fallback data: data/sia/snapshots/latest.json and data/sia/plan2545.json.
// Usage: npm run sia:snapshot [-- --no-plan]
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const loadTs = require('../../tests/load-ts.cjs')

const { newJob, runStep, jobDone, toSnapshot, validateSnapshot, planEntries } = loadTs(() => require('../../src/sia/job.ts'))
const root = join(__dirname, '..', '..')

async function main() {
  let state = newJob()
  let failures = 0
  while (!jobDone(state)) {
    try {
      state = await runStep(state, { deadline: Date.now() + 10 * 60_000 })
      process.stderr.write(`tipología ${Math.min(state.index + 1, state.typologies.length)}/${state.typologies.length} · ${Object.keys(state.courses).length} asignaturas · ${state.requests} peticiones\n`)
    } catch (error) {
      state = error.state ?? state
      if (++failures > 3) throw error
      process.stderr.write(`reintento tras error: ${error.message}\n`)
    }
  }
  const snapshot = toSnapshot(state)
  const problems = validateSnapshot(snapshot)
  if (problems.length) throw new Error(`Snapshot no válido; no se escribe nada:\n- ${problems.join('\n- ')}`)
  writeFileSync(join(root, 'data/sia/snapshots/latest.json'), JSON.stringify(snapshot, null, 1) + '\n')
  if (!process.argv.includes('--no-plan')) {
    const planPath = join(root, 'data/sia/plan2545.json')
    writeFileSync(planPath, JSON.stringify(planEntries(snapshot, JSON.parse(readFileSync(planPath, 'utf8'))), null, 1) + '\n')
  }
  process.stderr.write(`${snapshot.asignaturas.length} asignaturas en ${state.requests} peticiones\n`)
}

main().catch(error => { process.stderr.write(`Error consultando el SIA: ${error.message}\n`); process.exit(1) })
