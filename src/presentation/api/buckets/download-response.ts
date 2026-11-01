/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turning a bucket download — or its refusal — into an HTTP response.
 *
 * Everything here is response shaping: headers, the long-lived cache directive,
 * the two total mappings from a program's typed failure onto a status, and the
 * transform cache in front of the one program that produces the bytes. They sit
 * beside `buckets.ts` rather than inside it so the handler file reads as routing
 * and gating, which is all it should be.
 *
 * The 404-versus-500 split is the reason `storageFailureResponse` cannot move
 * to the application layer with the program it serves: it needs
 * `isNotFoundError`, a judgement about a DRIVER's message (S3 `NoSuchKey`,
 * local `ENOENT`, the bytea backend's "File not found"), which is a wire-level
 * concern rather than a property of the read.
 */

import { Effect } from 'effect'
import { produceTransformedFile } from '@/application/use-cases/buckets/bucket-file-programs'
import { isImageKey } from '@/domain/kernel/identity/mime-types'
import { isChatAttachmentKey } from '@/domain/kernel/identity/storage-key'
import { buildContentDisposition } from '@/domain/kernel/url/content-disposition'
import {
  buildTransformCacheKey,
  buildTransformETag,
} from '@/domain/models/app/buckets/image-transform-cache-key'
import {
  downloadTransformParams,
  hasTransformParams,
} from '@/domain/models/app/buckets/image-transform-params'
import {
  parsePresetEnv,
  resolvePresetTransform,
} from '@/domain/models/app/buckets/image-transform-presets'
import { logError } from '@/infrastructure/logging/logger'
import { resolveTransformOutputFormat } from '@/infrastructure/storage/apply-image-transform'
import { getCachedTransform, setCachedTransform } from '@/infrastructure/storage/transform-cache'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { isNotFoundError } from '@/presentation/api/runtime/error-sanitizer'
import { UNTRUSTED_FILE_CSP } from '@/presentation/api/runtime/untrusted-file-headers'
import type { StorageError } from '@/application/ports/services/storage-service'
import type { TransformParams } from '@/domain/models/app/buckets/image-transform-params'
import type { ImageTransformFailure } from '@/infrastructure/storage/apply-image-transform'
import type { Context } from 'hono'

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
      'Content-Security-Policy': UNTRUSTED_FILE_CSP,
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
 * removed. A source whose header declares more pixels than the pipeline will
 * decode is a `422`: the request is well-formed, this file cannot honour it,
 * and the original still downloads untouched. Anything else is a genuine server
 * fault and reports as `500`.
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
  if (failure.reason === 'too-large') {
    return c.json(
      storageErrorBody(
        `Stored image is too large to transform: ${failure.message}. Download the original instead.`,
        'VALIDATION_ERROR'
      ),
      422
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
  return isNotFound
    ? notFound(c, 'File not found')
    : c.json(storageErrorBody(`Download failed: ${message}`, 'STORAGE_ERROR'), 500)
}

/**
 * What a download answers once it may be served: the response itself when
 * nothing has to be read (a chat attachment, a refused transform, a matching
 * `If-None-Match`, a cache hit), or the program that produces the bytes.
 */
export const planDownload = (c: Context, key: string, bucket: string) =>
  // A chat attachment is served by the chat's route alone: here it is absent.
  isChatAttachmentKey(key)
    ? notFound(c, 'File not found')
    : serveTransformedDownload(c, key, bucket)

/**
 * Resolve any on-the-fly image transform request for a bucket download and
 * stream the result. Handles `?width=&height=&fit=&format=&quality=`
 * plus the named `?preset=` shorthand (resolved from the operator-controlled
 * `STORAGE_TRANSFORM_PRESETS` env var).
 *
 * Invalid transform parameters (the withdrawn `crop`, an unsupported `fit` or
 * `format`, an unknown preset name, or a `?preset=` with no presets configured)
 * are rejected with HTTP 400 before the storage lookup runs. Even without
 * explicit transform params, an image download may still be transcoded by
 * `Accept`-header format negotiation, so the default-params path always runs.
 */
function serveTransformedDownload(c: Context, key: string, bucket: string) {
  const query = c.req.query()
  const hasPreset = query['preset'] !== undefined && query['preset'] !== ''
  if (!hasPreset && !hasTransformParams(query)) {
    return serveFileDownload(c, key, downloadTransformParams(key), bucket)
  }

  const presets = parsePresetEnv(process.env['STORAGE_TRANSFORM_PRESETS'])
  // A preset-env parse error is an operator misconfiguration — the server
  // startup path rejects it, so by the time a
  // request runs the env is known-valid. Defensive 400 keeps types total.
  const parsed = presets.ok
    ? resolvePresetTransform(query, presets.presets)
    : { ok: false as const, error: presets.error }
  if (!parsed.ok) {
    return c.json(storageErrorBody(parsed.error, 'BAD_REQUEST'), 400)
  }
  // Explicit transform params (e.g. `?width=`) only apply to images.
  // Reject non-image files up front with HTTP 400 — a PDF or text file
  // cannot be resized/transcoded, so the request is a client error.
  if (!isImageKey(key)) {
    return c.json(
      storageErrorBody('Transform parameters can only be applied to image files', 'BAD_REQUEST'),
      400
    )
  }
  return serveFileDownload(c, key, parsed.params, bucket)
}

/**
 * Stream a file's bytes back to the client, transformed if the request asked
 * for it and cached by ETag either way.
 *
 * A matching `If-None-Match` short-circuits to 304 before storage is touched,
 * and a cache hit serves the previously transformed bytes directly; only a miss
 * reaches the application program.
 */
function serveFileDownload(c: Context, key: string, transform: TransformParams, bucket: string) {
  const acceptHeader = c.req.header('Accept')
  const resolvedFormat = resolveTransformOutputFormat(transform, acceptHeader)
  const cacheKey = buildTransformCacheKey(key, transform, resolvedFormat, bucket)
  const etag = buildTransformETag(cacheKey, (input) => Bun.hash(input).toString(16))

  if (c.req.header('If-None-Match') === etag) {
    return c.body(null, 304, { 'Cache-Control': TRANSFORM_CACHE_CONTROL, ETag: etag })
  }

  const hit = getCachedTransform(cacheKey)
  if (hit !== undefined) {
    return buildTransformResponse(key, hit)
  }

  return produceTransformResponse(c, key, transform, { cacheKey, etag, acceptHeader, bucket })
}

/**
 * Cache-miss path of {@link serveFileDownload}: produce the transformed bytes,
 * populate the transform cache, and build the HTTP response.
 */
function produceTransformResponse(
  c: Context,
  key: string,
  transform: TransformParams,
  ctx: {
    readonly cacheKey: string
    readonly etag: string
    readonly acceptHeader?: string
    readonly bucket: string
  }
) {
  return Effect.match(
    produceTransformedFile({
      key,
      bucket: ctx.bucket,
      transform,
      acceptHeader: ctx.acceptHeader,
    }),
    {
      onFailure: (failure) =>
        failure._tag === 'ImageTransformRejected'
          ? transformFailureResponse(c, failure.failure)
          : storageFailureResponse(c, failure, '[buckets] download (transform path) failed'),
      onSuccess: (produced) => {
        const cached = { ...produced, etag: ctx.etag }
        // Populate the cache so identical subsequent requests skip the transform.
        setCachedTransform(ctx.cacheKey, cached)

        return buildTransformResponse(key, cached)
      },
    }
  )
}
