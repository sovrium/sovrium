/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The download half of Sovrium's signed storage URLs: `GET
 * /api/buckets/:bucketName/signed` verifies the token and streams the object.
 */

import { Effect } from 'effect'
import { type BucketBinding } from '@/application/ports/services/storage-service'
import {
  signedLinkDisplay,
  verifiedDownloadBinding,
} from '@/application/use-cases/buckets/signed-download-binding'
import { resolveSignBucket } from '@/application/use-cases/buckets/signed-url-minting'
import {
  probeStoredFile,
  readRecordedFile,
} from '@/application/use-cases/storage/recorded-file-read'
import {
  inferMimeFromKey,
  isFramablePreviewKey,
  isInlineSafeImageKey,
} from '@/domain/kernel/identity/mime-types'
import { isChatAttachmentKey } from '@/domain/kernel/identity/storage-key'
import { buildContentDisposition } from '@/domain/kernel/url/content-disposition'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { isNotFoundError } from '@/presentation/api/runtime/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { SignedUrlDisplay } from '@/domain/models/app/buckets/signed-url-service'
import type { Context } from 'hono'

/**
 * Download a stored object via the configured `StorageService`.
 *
 * Returns an `Either`: `Right` carries the bytes, `Left` carries the storage
 * failure (inspected for not-found vs. hard error by the caller). Centralises
 * the `Effect.gen → provideDomain → Effect.result` boilerplate shared by the
 * file-existence probe and the signed-download stream.
 *
 * Takes the request context because the storage adapter comes from the runtime
 * the running server owns, resolved once at boot — see `provideDomain`.
 */
export function downloadFromStorage(c: Context, path: string, bucket: BucketBinding) {
  return Effect.runPromise(provideDomain(c, readRecordedFile(path, bucket)).pipe(Effect.result))
}

/**
 * Check whether a stored object exists as a download would find it, reading at
 * most its first piece. A chat attachment answers as absent: no bucket route
 * signs or serves one.
 */
export async function fileExists(c: Context, path: string, bucket: string): Promise<boolean> {
  if (isChatAttachmentKey(path)) return false
  const result = await Effect.runPromise(
    provideDomain(c, probeStoredFile(path, bucket)).pipe(Effect.result)
  )
  return result._tag === 'Success'
}

/**
 * Strip the `<uuid>-` prefix the upload handler prepends, so signed downloads
 * expose the original filename in the Content-Disposition header.
 */
function stripUuidPrefix(key: string): string {
  const match = key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)
  return match?.[1] ?? key
}

/**
 * Build the Content-Disposition header value, through the one builder that
 * escapes an uploaded name for a header (`buildContentDisposition`).
 *
 * SECURITY (Finding #2): only RASTER images (png/jpeg/gif/webp) are served
 * `inline` — they carry no active content. SVG (and any non-raster / active
 * type) is forced to `attachment` so a browser never renders it in a document
 * context where embedded `<script>` could run. Mirrors the main download path.
 */
function buildSignedContentDisposition(path: string): string {
  const disposition = isInlineSafeImageKey(path) ? 'inline' : 'attachment'
  return buildContentDisposition(fileNameOf(path), disposition)
}

/** The name a served object is saved or shown under: its key's last segment, unprefixed. */
function fileNameOf(path: string): string {
  return stripUuidPrefix(path).split('/').at(-1) ?? path
}

/**
 * The headers a served object answers with.
 *
 * Every download keeps the blocking CSP — even if a browser renders the bytes,
 * no embedded script / network / style can execute (Finding #2) — and the
 * platform's refusal to be framed. The one exception is the address a
 * `file-preview` frames: signed with the `inline` display claim AND naming a
 * framable type (a PDF), it is served `inline` and may be framed by this
 * origin's own pages, under the same `default-src 'none'`. A link signed for
 * download, or an inline link to any other type, is never framable.
 */
function servedHeaders(path: string, display: SignedUrlDisplay | undefined): HeadersInit {
  const base = { 'Content-Type': inferMimeFromKey(path), 'X-Content-Type-Options': 'nosniff' }
  if (display === 'inline' && isFramablePreviewKey(path)) {
    return {
      ...base,
      'Content-Disposition': buildContentDisposition(fileNameOf(path), 'inline'),
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
      'X-Frame-Options': 'SAMEORIGIN',
    }
  }
  return {
    ...base,
    'Content-Disposition': buildSignedContentDisposition(path),
    'Content-Security-Policy': "default-src 'none'",
  }
}

/** Download `path` via the StorageService and stream it back to the client. */
async function streamSignedDownload(
  c: Context,
  path: string,
  bucket: BucketBinding,
  display: SignedUrlDisplay | undefined
): Promise<Response> {
  // A chat attachment is served by the chat's own route only, as if absent here.
  if (isChatAttachmentKey(path)) return notFound(c, 'File not found')
  const result = await downloadFromStorage(c, path, bucket)
  if (result._tag === 'Failure') {
    const { cause } = result.failure as { readonly cause?: unknown }
    const isNotFound = isNotFoundError(cause)
    return isNotFound
      ? notFound(c, 'File not found')
      : c.json(storageErrorBody('Download failed', 'STORAGE_ERROR'), 500)
  }
  return new Response(Uint8Array.from(result.success), {
    status: 200,
    headers: servedHeaders(path, display),
  })
}

/**
 * Handle GET /api/buckets/:bucketName/signed.
 *
 * Serves a file referenced by a signed download URL. Verifies the HMAC token
 * and expiry before streaming bytes — no session is required, the token is
 * the proof of authorization.
 */
export function createHandleSignedServe(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    if (!resolveSignBucket(app, bucketName) || bucketName === undefined) {
      return notFound(c, 'Bucket not found')
    }

    const query = c.req.query()
    const { path, token } = query
    const operation = query['op'] === 'upload' ? 'upload' : 'download'
    const expires = Number(query['expires'])

    if (!path || !token || !Number.isFinite(expires)) {
      return c.json(storageErrorBody('Invalid signed URL', 'BAD_REQUEST'), 400)
    }

    // A download GET against an upload-only token is an operation mismatch.
    if (operation !== 'download') {
      return c.json(storageErrorBody('Operation mismatch', 'FORBIDDEN'), 403)
    }

    const display = signedLinkDisplay(query)
    const binding = verifiedDownloadBinding(query, { bucket: bucketName, path, expires }, token)
    if (binding === undefined) {
      return c.json(storageErrorBody('Invalid signature', 'FORBIDDEN'), 403)
    }
    if (Date.now() > expires) {
      return c.json(storageErrorBody('Signed URL expired', 'FORBIDDEN'), 403)
    }

    return streamSignedDownload(c, path, binding, display)
  }
}
