/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  constraintRefusalMessage,
  constraintsForSign,
} from '@/application/use-cases/buckets/signed-upload-constraints'
import {
  resolveExpiresIn,
  resolveSignBucket,
} from '@/application/use-cases/buckets/signed-url-minting'
import { checkUploadPath } from '@/application/use-cases/buckets/upload-policy'
import { fileExists } from '@/presentation/api/buckets/signed-download'
import {
  buildSignedUrl,
  objectStoredAt,
  refuseUnlessSignable,
} from '@/presentation/api/buckets/signed-urls'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { UploadConstraints } from '@/application/use-cases/buckets/signed-upload-constraints'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
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
  | { readonly path: string; readonly error: 'conflict' }

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
 * exist are returned with `error: 'not_found'`; upload entries carry their
 * HMAC-bound `contentType` / `maxSize`, clamped to the bucket exactly as the
 * single form clamps them, and an upload entry whose path already holds an
 * object is returned with `error: 'conflict'` — a signed upload writes a new
 * object, never over a stored one.
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

    const results = await signBatchEntries(c, bucket, files as readonly BatchFileRequest[])
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
  readonly constraints: UploadConstraints | undefined | 'invalid' | 'type-not-allowed'
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
  bucketConfig: Bucket,
  files: readonly BatchFileRequest[]
): Promise<readonly BatchResult[] | string> {
  if (files.some((file) => pathOf(file) === undefined)) return 'Missing path'
  // An upload entry names the key it creates, so it is held to the explicit-path rule.
  const pathRejection = files
    .filter((file) => operationOf(file) === 'upload')
    .map((file) => checkUploadPath(pathOf(file) as string))
    .find((rejection) => rejection !== undefined)
  if (pathRejection) return pathRejection.message
  const bucket = bucketConfig.name
  const signer = { bucket: bucketConfig, uploadedBy: getSessionContext(c)?.userId }
  const resolved: readonly ResolvedBatchEntry[] = files.map((file) => {
    const operation = operationOf(file)
    return {
      path: pathOf(file) as string,
      operation,
      expiresInSeconds: resolveExpiresIn(file.expiresIn),
      constraints: constraintsForSign(operation, file, signer),
    }
  })
  if (resolved.some((entry) => entry.expiresInSeconds === undefined)) {
    return 'Invalid expiresIn value'
  }
  // The first refusal in the order the single form checks them: a malformed
  // `maxSize` before a type the bucket does not accept.
  const refusal = (['invalid', 'type-not-allowed'] as const).find((reason) =>
    resolved.some((entry) => entry.constraints === reason)
  )
  if (refusal !== undefined) return constraintRefusalMessage(refusal)

  return Promise.all(
    resolved.map(async ({ path, operation, expiresInSeconds, constraints }) => {
      // Download entries must reference an existing file; upload entries must not.
      if (operation === 'download' && !(await fileExists(c, path, bucket))) {
        return { path, error: 'not_found' } as const
      }
      if (operation === 'upload' && (await objectStoredAt(c, path, bucket))) {
        return { path, error: 'conflict' } as const
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
