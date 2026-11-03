import { del, list, put } from '@vercel/blob'

/**
 * Blob storage for the SIA job. Every write gets a unique pathname and reads
 * pick the newest by upload time through the (consistent) list API, so a
 * CDN-cached old copy is never read back. Production and previews keep
 * separate prefixes, so testing a preview never touches production data.
 */
const prefix = `sia/${process.env.VERCEL_ENV ?? 'development'}/`

type Kind = 'job' | 'offer'

async function newest(kind: Kind) {
  const { blobs } = await list({ prefix: `${prefix}${kind}/`, limit: 100 })
  return blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
}

export async function readLatest<T>(kind: Kind): Promise<{ value: T; uploadedAt: string } | null> {
  const [latest] = await newest(kind)
  if (!latest) return null
  const response = await fetch(latest.url, { cache: 'no-store' })
  if (!response.ok) return null
  return { value: await response.json() as T, uploadedAt: new Date(latest.uploadedAt).toISOString() }
}

/** Writes a new version and prunes old ones, keeping the newest `keep`. */
export async function writeVersion(kind: Kind, value: unknown, keep = kind === 'offer' ? 3 : 2) {
  await put(`${prefix}${kind}/${Date.now()}.json`, JSON.stringify(value), { access: 'public', contentType: 'application/json', addRandomSuffix: false })
  const stale = (await newest(kind)).slice(keep)
  if (stale.length) await del(stale.map(blob => blob.url))
}
