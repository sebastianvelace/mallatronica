import { waitUntil } from '@vercel/functions'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { jobDone, newJob, runStep, toSnapshot, validateSnapshot, type JobState } from '../../src/sia/job.js'
import { readLatest, writeVersion } from './_store.js'

/**
 * Refreshes the SIA offer in short steps. The daily Vercel Cron starts a job;
 * each step works within the time budget, saves its progress and calls the
 * next step, until the snapshot is complete, validated and published.
 */
type StoredJob = JobState & { error?: string; errors?: number; problems?: string[]; publishedAt?: string; lockedUntil?: number }

const STEP_BUDGET_MS = Number(process.env.SIA_STEP_SECONDS ?? 45) * 1000
const MAX_STEPS = 60
const MAX_ERRORS = 5
const STALE_MS = 6 * 60 * 60 * 1000

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function summary(job: StoredJob) {
  return {
    startedAt: job.startedAt, updatedAt: job.updatedAt, steps: job.steps, requests: job.requests,
    typology: `${Math.min(job.index + 1, job.typologies.length)}/${job.typologies.length}`, courses: Object.keys(job.courses).length,
    done: jobDone(job), publishedAt: job.publishedAt ?? null, error: job.error ?? null, problems: job.problems ?? [],
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.authorization !== `Bearer ${secret}`) return json(response, 401, { ok: false })

  const url = new URL(request.url ?? '/', `https://${request.headers.host}`)
  const chained = url.searchParams.get('continue') === '1'
  const stored = (await readLatest<StoredJob>('job'))?.value ?? null
  const now = Date.now()

  let job: StoredJob
  if (!stored || (jobDone(stored) && !chained) || now - Date.parse(stored.updatedAt) > STALE_MS) job = newJob()
  else if (jobDone(stored)) return json(response, 200, { ok: true, idle: true, job: summary(stored) })
  else if ((stored.lockedUntil ?? 0) > now) return json(response, 200, { ok: true, busy: true, job: summary(stored) })
  else job = stored

  job.lockedUntil = now + STEP_BUDGET_MS + 30_000
  await writeVersion('job', job)
  try {
    job = { ...job, ...(await runStep(job, { deadline: Date.now() + STEP_BUDGET_MS })), error: undefined }
  } catch (error) {
    const partial = (error as { state?: JobState }).state
    job = { ...job, ...(partial ?? {}), error: error instanceof Error ? error.message : String(error), errors: (job.errors ?? 0) + 1 }
  }
  job.lockedUntil = 0

  if (jobDone(job)) {
    const snapshot = toSnapshot(job)
    job.problems = validateSnapshot(snapshot)
    // Only a complete, valid snapshot replaces the published one; otherwise the last good one stays.
    if (!job.problems.length) {
      await writeVersion('offer', snapshot)
      job.publishedAt = new Date().toISOString()
    }
  }
  await writeVersion('job', job)

  const more = !jobDone(job) && job.steps < MAX_STEPS && (job.errors ?? 0) < MAX_ERRORS
  if (more) {
    const headers: Record<string, string> = { Authorization: `Bearer ${secret}` }
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    if (bypass) headers['x-vercel-protection-bypass'] = bypass
    waitUntil(fetch(`https://${request.headers.host}/api/sia/cron?continue=1`, { headers }).catch(() => undefined))
  }
  return json(response, 200, { ok: true, next: more, job: summary(job) })
}
