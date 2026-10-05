/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  buildSignedUrl,
  constraintsForSign,
  fileExists,
  refuseUnlessSignable,
  resolveExpiresIn,
  resolveSignBucket,
} from '@/presentation/api/buckets/signed-urls'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import type { App } from '@/domain/models/app'
import type { UploadConstraints } from '@/presentation/api/buckets/signed-urls'
import type { Context } from 'hono'

/** Largest batch the `/sign/batch` endpoint accepts. */
const MAX_BATCH_SIZE = 100

/**
 * A single batch entry: download by default, or upload when `operation` is
 * `upload`. An upload entry takes the same `contentType` / `maxSize` as the
 * single form.
 */
interface BatchFileRequest {
  readonly path?: unknown
  readonly expiresIn?: number
  readonly operation?: 'download' | 'upload'
  readonly contentType?: unknown
  readonly maxSize?: unknown
}

type BatchResult =
  | {
      readonly path: string
      readonly signedUrl: string
      readonly expiresAt: string
    }
  | { readonly path: string; readonly error: 'not_found' }

/** The signing operation an entry asks for: download unless it says `upload`. */
function operationOf(entry: unknown): 'download' | 'upload' {
  return typeof entry === 'object' && entry !== null && 'operation' in entry
    ? entry.operation === 'upload'
      ? 'upload'
      : 'download'
    : 'download'
}

/**
 * The operations a batch body asks to sign. A body that names none (no array,
 * or an empty one) is judged as a download, as the single form judges a body
 * with no `operation`, so the gate never depends on how well-formed it is.
 */
function batchOperations(files: unknown): readonly ('download' | 'upload')[] {
  const asked = Array.isArray(files) ? [...new Set(files.map(operationOf))] : []
  return asked.length === 0 ? ['download'] : asked
}

/**
 * Handle POST /api/buckets/:bucketName/sign/batch.
 *
 * Generates signed URLs for up to 100 file paths in a single request. Every
 * entry is judged by the grants of the single form (`sign` for downloads,
 * `signUpload` for uploads) BEFORE any file is looked up: one refused entry
 * refuses the whole batch exactly as the single form refuses one file, so a
 * batch never signs more than one-at-a-time requests could, and a refusal
 * says nothing about which files exist. Download entries whose file does not
 * exist are returned with `error: 'not_found'`; upload entries are always
 * signed and carry their HMAC-bound `contentType` / `maxSize`.
 */
export function createHandleBatchSign(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    const bucket = resolveSignBucket(app, bucketName)
    if (!bucket || bucketName === undefined) {
      return notFound(c, 'Bucket not found')
    }

    const { files } = (await c.req.json().catch(() => ({}))) as { readonly files?: unknown }
    const refusal = await refuseUnlessSignable(c, app, bucket, batchOperations(files))
    if (refusal) return refusal

    if (!Array.isArray(files)) {
      return c.json(storageErrorBody('Missing files array', 'BAD_REQUEST'), 400)
    }
    if (files.length > MAX_BATCH_SIZE) {
      return c.json(
        storageErrorBody(
          `Batch size ${files.length} exceeds the ${MAX_BATCH_SIZE}-file limit`,
          'BAD_REQUEST'
        ),
        400
      )
    }

    const results = await signBatchEntries(c, bucketName, files as readonly BatchFileRequest[])
    if (typeof results === 'string') {
      return c.json(storageErrorBody(results, 'BAD_REQUEST'), 400)
    }
    return c.json({ results })
  }
}

/** One batch entry with its lifetime and upload constraints resolved. */
interface ResolvedBatchEntry {
  readonly path: string
  readonly operation: 'download' | 'upload'
  readonly expiresInSeconds: number | undefined
  readonly constraints: UploadConstraints | undefined | 'invalid'
}

/**
 * The text path a batch entry names, or `undefined` when it names none: no
 * `path`, an empty one, one that is not text, or an entry that is not an
 * object. Judged as the single form judges its body's `path`.
 */
function pathOf(entry: unknown): string | undefined {
  if (typeof entry !== 'object' || entry === null) return undefined
  const { path } = entry as BatchFileRequest
  return typeof path === 'string' && path.length > 0 ? path : undefined
}

/**
 * Sign every entry in the batch. Returns the 400 message instead when any
 * entry names no text path (`Missing path`, as the single form answers) or has
 * an out-of-range `expiresIn` or `maxSize`: the whole request is then
 * rejected and nothing is signed.
 */
async function signBatchEntries(
  c: Context,
  bucket: string,
  files: readonly BatchFileRequest[]
): Promise<readonly BatchResult[] | string> {
  if (files.some((file) => pathOf(file) === undefined)) return 'Missing path'
  const resolved: readonly ResolvedBatchEntry[] = files.map((file) => {
    const operation = operationOf(file)
    return {
      path: pathOf(file) as string,
      operation,
      expiresInSeconds: resolveExpiresIn(file.expiresIn),
      constraints: constraintsForSign(operation, file),
    }
  })
  if (resolved.some((entry) => entry.expiresInSeconds === undefined)) {
    return 'Invalid expiresIn value'
  }
  if (resolved.some((entry) => entry.constraints === 'invalid')) return 'Invalid maxSize value'

  return Promise.all(
    resolved.map(async ({ path, operation, expiresInSeconds, constraints }) => {
      // Download entries must reference an existing file; upload entries do not.
      if (operation === 'download' && !(await fileExists(c, path, bucket))) {
        return { path, error: 'not_found' } as const
      }
      const { signedUrl, expiresAt } = buildSignedUrl({
        c,
        bucket,
        path,
        operation,
        expiresInSeconds: expiresInSeconds as number,
        constraints: constraints as UploadConstraints | undefined,
      })
      return { path, signedUrl, expiresAt }
    })
  )
}
