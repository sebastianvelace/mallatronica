import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJson } from './_store.js'

/** Outcome of the last SIA refresh: when it finished, whether it published, and any problem. */
export default async function handler(_request: IncomingMessage, response: ServerResponse) {
  const status = await readJson<unknown>('status')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'public, s-maxage=300')
  response.end(JSON.stringify(status ? { ...(status.value as object), recordedAt: status.uploadedAt } : { finishedAt: null, published: false, problems: ['Todavía no ha corrido ninguna actualización.'] }))
}
