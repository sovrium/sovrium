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
import {
  StorageService,
  UNATTRIBUTED_BUCKET,
  type BucketBinding,
} from '@/application/ports/services/storage-service'
import { resolveSignBucket } from '@/application/use-cases/buckets/signed-url-minting'
import { resolveStorageSigningSecret } from '@/application/use-cases/storage/signing-secret'
import { inferMimeFromKey, isInlineSafeImageKey } from '@/domain/kernel/identity/mime-types'
import { buildContentDisposition } from '@/domain/kernel/url/content-disposition'
import { verifySignedUrl } from '@/domain/models/app/buckets/signed-url-service'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { isNotFoundError } from '@/presentation/api/runtime/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { SignedUrlClaims } from '@/domain/models/app/buckets/signed-url-service'
import type { Context } from 'hono'

/** Whether `token` is the one minted for these claims (constant-time). */
const tokenVerifies = (claims: SignedUrlClaims, token: string): boolean =>
  verifySignedUrl(resolveStorageSigningSecret(process.env), claims, token)

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
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.download(path, bucket)
  })
  return Effect.runPromise(provideDomain(c, program).pipe(Effect.result))
}

/** Check whether a stored object exists by attempting a download. */
export async function fileExists(c: Context, path: string, bucket: string): Promise<boolean> {
  const result = await downloadFromStorage(c, path, bucket)
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
  const segments = stripUuidPrefix(path).split('/')
  const filename = segments.at(-1) ?? path
  return buildContentDisposition(filename, disposition)
}

/** Download `path` via the StorageService and stream it back to the client. */
async function streamSignedDownload(
  c: Context,
  path: string,
  bucket: BucketBinding
): Promise<Response> {
  const result = await downloadFromStorage(c, path, bucket)
  if (result._tag === 'Failure') {
    const { cause } = result.failure as { readonly cause?: unknown }
    const isNotFound = isNotFoundError(cause)
    return isNotFound
      ? notFound(c, 'File not found')
      : c.json(storageErrorBody('Download failed', 'STORAGE_ERROR'), 500)
  }
  const body = Uint8Array.from(result.success)
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': inferMimeFromKey(path),
      'Content-Disposition': buildSignedContentDisposition(path),
      // Blocking CSP — even if a browser renders the bytes, no embedded
      // script / network / style can execute. Mirrors the main download path
      // (`buckets.ts` buildTransformResponse). Finding #2 remediation.
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
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

    const binding = verifiedDownloadBinding(query, { bucket: bucketName, path, expires }, token)
    if (binding === undefined) {
      return c.json(storageErrorBody('Invalid signature', 'FORBIDDEN'), 403)
    }
    if (Date.now() > expires) {
      return c.json(storageErrorBody('Signed URL expired', 'FORBIDDEN'), 403)
    }

    return streamSignedDownload(c, path, binding)
  }
}

/**
 * The bucket a verified download link reads its object through, or `undefined`
 * when the token does not verify. A link an automation step minted carries the
 * `automation` scope and reaches its object as the automation's `file` actions
 * do, bucket-less; the scope is bound into the token, so no link signed for a
 * bucket can claim it.
 */
function verifiedDownloadBinding(
  query: Readonly<Record<string, string>>,
  claims: { readonly bucket: string; readonly path: string; readonly expires: number },
  token: string
): BucketBinding | undefined {
  const download = { ...claims, operation: 'download' as const }
  if (query['scope'] === 'automation') {
    return tokenVerifies({ ...download, scope: 'automation' }, token)
      ? UNATTRIBUTED_BUCKET
      : undefined
  }
  return tokenVerifies(download, token) ? claims.bucket : undefined
}
