/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turning a bucket download — or its refusal — into an HTTP response.
 *
 * Everything here is response shaping and nothing here does work: headers, the
 * long-lived cache directive, and the two total mappings from a program's typed
 * failure onto a status. They sit beside `buckets.ts` rather than inside it so
 * the handler file reads as routing and gating, which is all it should be.
 *
 * The 404-versus-500 split is the reason `storageFailureResponse` cannot move
 * to the application layer with the program it serves: it needs
 * `isNotFoundError`, a judgement about a DRIVER's message (S3 `NoSuchKey`,
 * local `ENOENT`, the bytea backend's "File not found"), which is a wire-level
 * concern rather than a property of the read.
 */

import { logError } from '@/infrastructure/logging/logger'
import { storageErrorBody } from '@/presentation/api/runtime/auth-helpers'
import { isNotFoundError } from '@/presentation/api/runtime/error-sanitizer'
import type { StorageError } from '@/application/ports/services/storage-service'
import type { ImageTransformFailure } from '@/infrastructure/storage/apply-image-transform'
import type { Context } from 'hono'

/**
 * Build a safe Content-Disposition header value for a filename.
 * ASCII-only names use the simple `filename=` parameter; names with non-ASCII
 * characters use RFC 5987 `filename*=UTF-8''<percent-encoded>` to avoid
 * TypeError from raw multi-byte characters in header values.
 */
function buildContentDisposition(filename: string): string {
  if (/^[\x20-\x7E]*$/.test(filename)) {
    return `attachment; filename="${filename}"`
  }
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/** Long-lived cache lifetime for transformed image responses: one year. */
export const TRANSFORM_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * Build the final HTTP response for a transformed download from the cached
 * bytes + metadata, attaching the long-term `Cache-Control` and content
 * `ETag` headers. The same shape is used whether the bytes came from the
 * transform cache or were just produced.
 */
export function buildTransformResponse(
  key: string,
  cached: { readonly bytes: Uint8Array; readonly contentType: string; readonly etag: string }
): Response {
  // Copy bytes into a fresh ArrayBuffer-backed Uint8Array. TypeScript 6's
  // bare `Uint8Array` defaults to `Uint8Array<ArrayBufferLike>`, which is not
  // assignable to `BodyInit` (which requires `Uint8Array<ArrayBuffer>`).
  const body = Uint8Array.from(cached.bytes)
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': cached.contentType,
      'Content-Disposition': buildContentDisposition(stripUuidPrefix(key)),
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': TRANSFORM_CACHE_CONTROL,
      ETag: cached.etag,
    },
  })
}

/**
 * Strip the `<uuid>-` prefix the upload handler prepends, so downloads expose
 * the original filename in the Content-Disposition header.
 */
function stripUuidPrefix(key: string): string {
  const match = key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)
  return match?.[1] ?? key
}

/**
 * Turn a transform failure into HTTP.
 *
 * An undecodable stored file, or an encoder this build does not carry, is a
 * `400`: the caller asked for something this file or this machine cannot
 * produce, and saying so is the entire reason the silent passthrough was
 * removed. Anything else is a genuine server fault and reports as `500`.
 */
export function transformFailureResponse(
  c: Context,
  failure: Readonly<ImageTransformFailure>
): Response {
  if (failure.reason === 'failed') {
    logError('[buckets] image transform failed', failure.message)
    return c.json(
      storageErrorBody(`Image transform failed: ${failure.message}`, 'TRANSFORM_ERROR'),
      500
    )
  }
  const error =
    failure.reason === 'undecodable'
      ? `Stored file is not a decodable image: ${failure.message}`
      : `Requested image format is not available on this server: ${failure.message}`
  return c.json(storageErrorBody(error, 'BAD_REQUEST'), 400)
}

/**
 * Turn a storage failure into HTTP.
 *
 * `isNotFoundError` is the single canonical "is 404?" — see it for the patterns
 * covered (S3 NoSuchKey, local ENOENT, bytea "File not found", etc.). A genuine
 * fault is logged; an absent key is not, because that is ordinary traffic.
 */
export function storageFailureResponse(c: Context, failure: StorageError, label: string): Response {
  const { cause } = failure
  const isNotFound = isNotFoundError(cause)
  if (!isNotFound) {
    logError(label, failure)
  }
  const message = cause instanceof Error ? cause.message : String(cause)
  return c.json(
    storageErrorBody(
      isNotFound ? 'File not found' : `Download failed: ${message}`,
      isNotFound ? 'NOT_FOUND' : 'STORAGE_ERROR'
    ),
    isNotFound ? 404 : 500
  )
}
