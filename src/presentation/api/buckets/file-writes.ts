/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** The HTTP half of a bucket write once it has been admitted: the stored upload, and a failed delete. */

import { Effect } from 'effect'
import {
  checkStorageQuota,
  storeBucketFile,
} from '@/application/use-cases/buckets/bucket-file-programs'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { buildUploadStorageKey } from '@/infrastructure/storage/upload-key'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { isNotFoundError } from '@/presentation/api/runtime/error-sanitizer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { Context } from 'hono'

/**
 * Persist a validated upload and return the HTTP response.
 *
 * The quota probe runs FIRST and its verdict is advisory by construction: an
 * unreadable total allows the write (see `checkStorageQuota`), so a read-side
 * outage never becomes a write-side one.
 */
export async function persistUpload(
  c: Context,
  file: File,
  target: { readonly bucket: string; readonly session: UserSession | undefined },
  explicitPath?: string
): Promise<Response> {
  const { bucket } = target
  // The signed-in person behind the write is recorded as its uploader.
  const uploadedById = target.session?.userId
  const arrayBuffer = await file.arrayBuffer()
  const content = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'
  // An explicit `path` is stored verbatim (enables path-prefixed public keys);
  // otherwise a random per-upload key avoids filename collisions while keeping
  // the human-readable filename as a suffix for debugging convenience (shared
  // `<uuid>-<filename>` convention — see {@link buildUploadStorageKey}).
  const key = explicitPath ?? buildUploadStorageKey(file.name)

  const quota = await runRequestEffect(c, provideDomain(c, checkStorageQuota(content.length)))
  if (quota.kind === 'exceeded') {
    return c.json(
      storageErrorBody(
        `Storage quota exceeded: ${quota.projected} > ${quota.cap} bytes`,
        'QUOTA_EXCEEDED'
      ),
      507
    )
  }

  const result = await runRequestEffect(
    c,
    provideDomain(c, storeBucketFile({ key, content, mimeType, bucket, uploadedById })).pipe(
      Effect.result
    )
  )
  if (result._tag === 'Failure') {
    const { cause } = result.failure
    logError('[buckets] upload failed', result.failure)
    // An explicit `path` lets a caller aim an ordinary upload at a key another
    // bucket owns. The storage layer refuses that write as not-found; answer 404
    // with the generic message rather than echoing it inside a 500, so the
    // refusal is indistinguishable from an absent key (S1).
    if (isNotFoundError(cause)) {
      return notFound(c, 'File not found')
    }
    const message = cause instanceof Error ? cause.message : String(cause)
    return c.json(storageErrorBody(`Upload failed: ${message}`, 'STORAGE_ERROR'), 500)
  }

  // A write at an explicit path may replace an object already served: drop its
  // cached transforms, or the next download answers the bytes it replaced.
  evictTransformCacheForKey(key)

  return c.json({ success: true, key, size: content.length, mimeType, filename: file.name }, 201)
}

/** The 404 an absent object earns on delete, or the 500 any other storage failure does. */
export function deleteFailureResponse(c: Context, failure: { readonly cause: unknown }): Response {
  const { cause } = failure
  const isNotFound = isNotFoundError(cause)
  if (!isNotFound) {
    logError('[buckets] delete failed', failure)
  }
  const message = cause instanceof Error ? cause.message : String(cause)
  return isNotFound
    ? notFound(c, 'File not found')
    : c.json(storageErrorBody(`Delete failed: ${message}`, 'STORAGE_ERROR'), 500)
}
