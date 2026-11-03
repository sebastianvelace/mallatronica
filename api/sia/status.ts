import type { IncomingMessage, ServerResponse } from 'node:http'
import { readLatest } from './_store.js'

type Job = { startedAt: string; updatedAt: string; steps: number; requests: number; index: number; typologies: string[]; courses: Record<string, unknown>; publishedAt?: string; error?: string; problems?: string[] }

/** Public health of the SIA refresh: last run, last publication and last error. */
export default async function handler(_request: IncomingMessage, response: ServerResponse) {
  const [job, offer] = await Promise.all([readLatest<Job>('job').catch(() => null), readLatest<{ fuente: { consultado: string } }>('offer').catch(() => null)])
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify({
    published: offer ? { consultedAt: offer.value.fuente.consultado, uploadedAt: offer.uploadedAt } : null,
    job: job ? {
      startedAt: job.value.startedAt, updatedAt: job.value.updatedAt, steps: job.value.steps, requests: job.value.requests,
      progress: `${Math.min(job.value.index, job.value.typologies.length)}/${job.value.typologies.length}`, courses: Object.keys(job.value.courses).length,
      publishedAt: job.value.publishedAt ?? null, error: job.value.error ?? null, problems: job.value.problems ?? [],
    } : null,
  }))
}
