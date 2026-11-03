import type { IncomingMessage, ServerResponse } from 'node:http'
import { readJson } from './_store.js'

/** Latest published SIA snapshot, cached at the edge for an hour; the app falls back to its bundled copy on any error. */
export default async function handler(_request: IncomingMessage, response: ServerResponse) {
  const latest = await readJson<unknown>('offer')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (!latest) {
    response.statusCode = 404
    response.setHeader('Cache-Control', 'public, s-maxage=600')
    return response.end(JSON.stringify({ error: 'Todavía no hay un snapshot publicado.' }))
  }
  response.statusCode = 200
  response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  response.end(JSON.stringify(latest.value))
}
