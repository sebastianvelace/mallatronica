import { waitUntil } from '@vercel/functions'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { jobDone, newJob, runStep, toSnapshot, validateSnapshot, type JobState } from '../../src/sia/job.js'
import { hasBlobCredentials, writeJson } from './_store.js'

/**
 * Refreshes the SIA offer once a day. Vercel Cron calls GET, which starts a
 * job. Every invocation answers right away and does its work in the
 * background (waitUntil): one step within the time budget, then it hands its
 * progress to the next step in the body of a POST, so no storage is used
 * along the way. Only the final, validated snapshot and the run's status are
 * written.
 */
type RunState = JobState & { errors?: number; lastError?: string }

// Leaves room under the 300 s maxDuration for chaining and writing.
const STEP_BUDGET_MS = Number(process.env.SIA_STEP_SECONDS ?? 240) * 1000
const MAX_STEPS = 20
const MAX_ERRORS = 4

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function summary(job: RunState) {
  return {
    startedAt: job.startedAt, updatedAt: job.updatedAt, steps: job.steps, requests: job.requests,
    progress: `${Math.min(job.index, job.typologies.length)}/${job.typologies.length}`, courses: Object.keys(job.courses).length,
    errors: job.errors ?? 0, lastError: job.lastError ?? null,
  }
}

/**
 * Where the next step is sent. Deployment URLs (VERCEL_URL, and the Host of
 * a cron call) sit behind Vercel Authentication by default, so production
 * chains through its public domain; previews need the automation bypass.
 */
function nextUrl(request: IncomingMessage) {
  const host = process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : request.headers.host
  return `https://${host}/api/sia/cron`
}

async function finish(job: RunState, extraProblem?: string) {
  const snapshot = toSnapshot(job)
  const problems = extraProblem ? [extraProblem]
    : jobDone(job) ? validateSnapshot(snapshot)
    : ['El trabajo no terminó: se alcanzó el límite de pasos o de errores.']
  if (!problems.length) await writeJson('offer', snapshot)
  const status = { finishedAt: new Date().toISOString(), published: !problems.length, problems, job: summary(job) }
  await writeJson('status', status)
  console.log('[sia] fin', JSON.stringify(status))
}

async function work(job: RunState, url: string, secret: string) {
  try {
    job = { ...job, ...(await runStep(job, { deadline: Date.now() + STEP_BUDGET_MS })) }
  } catch (error) {
    const partial = (error as { state?: JobState }).state
    job = { ...job, ...(partial ?? {}), errors: (job.errors ?? 0) + 1, lastError: error instanceof Error ? error.message : String(error) }
    console.error('[sia] error en el paso', job.lastError)
  }
  console.log('[sia] paso', JSON.stringify(summary(job)))

  if (jobDone(job) || job.steps >= MAX_STEPS || (job.errors ?? 0) >= MAX_ERRORS) return finish(job)

  const headers: Record<string, string> = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (bypass) headers['x-vercel-protection-bypass'] = bypass
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(job), signal: AbortSignal.timeout(20_000) })
    if (response.status !== 202) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    const message = `No se pudo encadenar el siguiente paso (${url}): ${error instanceof Error ? error.message : String(error)}`
    console.error('[sia]', message)
    await finish(job, message)
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.authorization !== `Bearer ${secret}`) {
    console.warn('[sia] llamada rechazada:', secret ? 'clave incorrecta' : 'falta CRON_SECRET')
    return json(response, 401, { ok: false })
  }
  if (!hasBlobCredentials()) {
    console.error('[sia] falta BLOB_STORE_ID: conecta el Blob al proyecto y redespliega')
    return json(response, 500, { ok: false, error: 'Falta la conexión con Vercel Blob.' })
  }

  let job: RunState
  if (request.method === 'POST') {
    try {
      job = JSON.parse(await readBody(request)) as RunState
    } catch {
      return json(response, 400, { ok: false, error: 'Estado inválido.' })
    }
  } else {
    job = newJob()
    console.log('[sia] inicio de la actualización')
  }

  waitUntil(work(job, nextUrl(request), secret).catch(error => console.error('[sia] fallo inesperado', error)))
  return json(response, 202, { ok: true, step: job.steps + 1 })
}
