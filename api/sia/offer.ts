import type { IncomingMessage, ServerResponse } from 'node:http'
import { readLatest } from './_store.js'

/** Latest published SIA snapshot, cached at the edge; the app falls back to its bundled copy on any error. */
export default async function handler(_request: IncomingMessage, response: ServerResponse) {
  const latest = await readLatest<unknown>('offer').catch(() => null)
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (!latest) {
    response.statusCode = 404
    response.setHeader('Cache-Control', 'public, s-maxage=300')
    return response.end(JSON.stringify({ error: 'Todavía no hay un snapshot publicado.' }))
  }
  response.statusCode = 200
  response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400')
  response.end(JSON.stringify(latest.value))
}
