import { head, put } from '@vercel/blob'

/**
 * Blob storage for the SIA refresh, kept to a couple of writes per day so it
 * fits the Hobby plan (2,000 advanced operations per month): the published
 * snapshot and the last run's status, each at a fixed pathname. Reads use
 * head() (a simple operation) and are cached at the edge by the endpoints.
 * Production and previews keep separate prefixes.
 */
const prefix = `sia/${process.env.VERCEL_ENV ?? 'development'}/`

export async function writeJson(name: 'offer' | 'status', value: unknown) {
  await put(`${prefix}${name}.json`, JSON.stringify(value), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    // Overwritten blobs refresh at the edge within a minute.
    cacheControlMaxAge: 60,
  })
}

export async function readJson<T>(name: 'offer' | 'status'): Promise<{ value: T; uploadedAt: string } | null> {
  try {
    const blob = await head(`${prefix}${name}.json`)
    const response = await fetch(blob.url)
    if (!response.ok) return null
    return { value: await response.json() as T, uploadedAt: new Date(blob.uploadedAt).toISOString() }
  } catch {
    return null
  }
}
