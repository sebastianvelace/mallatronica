import { get, put } from '@vercel/blob'

/**
 * Blob storage for the SIA refresh, kept to a couple of writes per day so it
 * fits the Hobby plan (2,000 advanced operations per month): the published
 * snapshot and the last run's status, each at a fixed pathname in a private
 * store. On Vercel the SDK authenticates with the project's OIDC token and
 * BLOB_STORE_ID (BLOB_READ_WRITE_TOKEN also works). The endpoints cache what
 * they read at the edge. Production and previews keep separate prefixes.
 */
const prefix = `sia/${process.env.VERCEL_ENV ?? 'development'}/`

export const hasBlobCredentials = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)

export async function writeJson(name: 'offer' | 'status', value: unknown) {
  await put(`${prefix}${name}.json`, JSON.stringify(value), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function readJson<T>(name: 'offer' | 'status'): Promise<{ value: T; uploadedAt: string } | null> {
  try {
    const result = await get(`${prefix}${name}.json`, { access: 'private', useCache: false })
    if (result?.statusCode !== 200) return null
    const value = await new Response(result.stream).json() as T
    return { value, uploadedAt: result.blob.uploadedAt.toISOString() }
  } catch (error) {
    console.error(`[sia] no se pudo leer ${name}.json`, error instanceof Error ? error.message : error)
    return null
  }
}
