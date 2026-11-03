import { waitUntil } from '@vercel/functions'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { jobDone, newJob, runStep, toSnapshot, validateSnapshot, type JobState } from '../../src/sia/job.js'
import { writeJson } from './_store.js'

/**
 * Refreshes the SIA offer once a day. Vercel Cron calls GET, which starts a
 * job; each step works within the time budget and hands its progress to the
 * next step in the request body (POST), so no storage is used along the way.
 * Only the final, validated snapshot and the run's status are written.
 */
type RunState = JobState & { errors?: number; lastError?: string }

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

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.authorization !== `Bearer ${secret}`) return json(response, 401, { ok: false })

  let job: RunState
  if (request.method === 'POST') {
    try {
      job = JSON.parse(await readBody(request)) as RunState
    } catch {
      return json(response, 400, { ok: false, error: 'Estado inválido.' })
    }
  } else {
    job = newJob()
  }

  try {
    job = { ...job, ...(await runStep(job, { deadline: Date.now() + STEP_BUDGET_MS })) }
  } catch (error) {
    const partial = (error as { state?: JobState }).state
    job = { ...job, ...(partial ?? {}), errors: (job.errors ?? 0) + 1, lastError: error instanceof Error ? error.message : String(error) }
  }

  const canContinue = !jobDone(job) && job.steps < MAX_STEPS && (job.errors ?? 0) < MAX_ERRORS
  if (canContinue) {
    const headers: Record<string, string> = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    if (bypass) headers['x-vercel-protection-bypass'] = bypass
    waitUntil(fetch(`https://${request.headers.host}/api/sia/cron`, { method: 'POST', headers, body: JSON.stringify(job) }).catch(() => undefined))
    return json(response, 200, { ok: true, next: true, job: summary(job) })
  }

  // Finished or gave up: publish only a complete, valid snapshot; always record the outcome.
  const snapshot = toSnapshot(job)
  const problems = jobDone(job) ? validateSnapshot(snapshot) : ['El trabajo no terminó: se alcanzó el límite de pasos o de errores.']
  if (!problems.length) await writeJson('offer', snapshot)
  const status = { finishedAt: new Date().toISOString(), published: !problems.length, problems, job: summary(job) }
  await writeJson('status', status)
  return json(response, 200, { ok: true, next: false, ...status })
}
