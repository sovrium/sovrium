/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { readStoredObjectOwner } from '@/application/use-cases/buckets/bucket-file-programs'
import {
  constraintRefusalMessage,
  constraintsForSign,
  uploadTypeAllowed,
  withUploader,
  type SignRequestBody,
  type UploadConstraints,
} from '@/application/use-cases/buckets/signed-upload-constraints'
import {
  mintSignedUrl,
  resolveExpiresIn,
  resolveSignBucket,
} from '@/application/use-cases/buckets/signed-url-minting'
import { resolveStorageSigningSecret } from '@/application/use-cases/storage/signing-secret'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { inferMimeFromKey, isInlineSafeImageKey } from '@/domain/kernel/identity/mime-types'
import { buildContentDisposition } from '@/domain/kernel/url/content-disposition'
import { canSignBucketUrl } from '@/domain/models/app/buckets/bucket-sign-validation'
import { verifySignedUrl } from '@/domain/models/app/buckets/signed-url-service'
import { provideDomain, runDomainPromise } from '@/infrastructure/logging/request-effect'
import {
  payloadTooLarge,
  storageErrorBody,
  notFound,
} from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { isNotFoundError } from '@/presentation/api/runtime/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { SignedUrlClaims } from '@/domain/models/app/buckets/signed-url-service'
import type { Context } from 'hono'

/**
 * Resolve the HMAC secret used to sign storage URL tokens.
 *
 * Delegates to the single resolver shared with the record enricher, so a token
 * minted here always verifies there. See `resolveStorageSigningSecret` for why
 * the previous `'sovrium-signed-url-dev-secret'` fallback had to go.
 */
function signingSecret(): string {
  return resolveStorageSigningSecret(process.env)
}

/** Whether `token` is the one minted for these claims (constant-time). */
function tokenVerifies(claims: SignedUrlClaims, token: string): boolean {
  return verifySignedUrl(signingSecret(), claims, token)
}

/** Parameters for {@link buildSignedUrl}. */
interface SignedUrlSpec {
  readonly c: Context
  readonly bucket: string
  readonly path: string
  readonly operation: 'download' | 'upload'
  readonly expiresInSeconds: number
  readonly constraints?: UploadConstraints
}

/**
 * Build the absolute signed URL for one path through the shared minter,
 * deriving the origin from the incoming request so the URL round-trips against
 * the same server.
 */
export function buildSignedUrl(spec: SignedUrlSpec): {
  readonly signedUrl: string
  readonly expiresAt: string
} {
  const { c, ...request } = spec
  return mintSignedUrl(request, {
    secret: signingSecret(),
    now: Date.now(),
    origin: new URL(c.req.url).origin,
  })
}

/**
 * Whether the bucket already holds an object at `path`, read from the catalog
 * without touching the bytes. A signed upload writes a NEW object: replacing
 * one goes through the upload route, where the object's owner is checked
 * first. An unreadable catalog answers `false` here — the write that
 * follows reads the same catalog and surfaces the outage itself.
 */
export async function objectStoredAt(c: Context, path: string, bucket: string): Promise<boolean> {
  const result = await Effect.runPromise(
    provideDomain(c, readStoredObjectOwner({ key: path, bucket })).pipe(Effect.result)
  )
  return result._tag === 'Success' && result.success.stored
}

/** The 409 a signed upload aimed at a stored object earns, at signing and at `PUT`. */
const objectAlreadyStored = (c: Context): Response =>
  c.json(storageErrorBody('An object is already stored at this path', 'CONFLICT'), 409)

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

function downloadFromStorage(c: Context, path: string, bucket: string) {
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

    if (!tokenVerifies({ bucket: bucketName, path, operation: 'download', expires }, token)) {
      return c.json(storageErrorBody('Invalid signature', 'FORBIDDEN'), 403)
    }
    if (Date.now() > expires) {
      return c.json(storageErrorBody('Signed URL expired', 'FORBIDDEN'), 403)
    }

    return streamSignedDownload(c, path, bucketName)
  }
}

/** The signer an upload URL names (`by`), or `undefined` for an anonymous one. */
const uploaderOf = (query: Readonly<Record<string, string>>): string | undefined =>
  query['by'] === undefined || query['by'] === '' ? undefined : query['by']

/** Parameters for a verified signed-upload request. */
interface SignedUploadParams {
  readonly bucket: string
  readonly path: string
  readonly token: string
  readonly expires: number
  readonly contentType: string
  readonly maxSize: number
  readonly uploadedBy: string | undefined
}

/**
 * Parse and HMAC-verify the query string of a PUT against
 * `/api/buckets/:bucketName/signed`. Returns the verified upload parameters,
 * or an error `Response` to send back when the URL is invalid, tampered, or
 * expired.
 */
function verifySignedUpload(c: Context, bucketName: string): SignedUploadParams | Response {
  const query = c.req.query()
  const { path, token } = query
  const operation = query['op'] === 'upload' ? 'upload' : 'download'
  const expires = Number(query['expires'])
  const contentType = query['ct'] ?? ''
  const maxSize = Number(query['max'])
  const uploadedBy = uploaderOf(query)

  if (!path || !token || !Number.isFinite(expires)) {
    return c.json(storageErrorBody('Invalid signed URL', 'BAD_REQUEST'), 400)
  }
  // A PUT against a download-only token is an operation mismatch.
  if (operation !== 'upload' || !Number.isFinite(maxSize)) {
    return c.json(storageErrorBody('Operation mismatch', 'FORBIDDEN'), 403)
  }

  const claims: SignedUrlClaims = {
    bucket: bucketName,
    path,
    operation: 'upload',
    expires,
    constraints: withUploader({ contentType, maxSize }, uploadedBy),
  }
  if (!tokenVerifies(claims, token)) {
    return c.json(storageErrorBody('Invalid signature', 'FORBIDDEN'), 403)
  }
  if (Date.now() > expires) {
    return c.json(storageErrorBody('Signed URL expired', 'FORBIDDEN'), 403)
  }

  return { bucket: bucketName, path, token, expires, contentType, maxSize, uploadedBy }
}

/**
 * Enforce the token-bound `contentType` / `maxSize` constraints and write the
 * verified upload to storage. Extracted from {@link createHandleSignedUpload}
 * to keep that handler under the per-function complexity threshold.
 *
 * - Wrong `Content-Type` vs. the bound constraint, or — when the URL bound
 *   none — a type the bucket's `allowedMimeTypes` refuses → 400
 * - Body larger than the bound `maxSize` → 413
 * - The bucket already holds an object at the path → 409
 * - Storage write failure → 500
 * - Stored successfully → 200, attributed to the person who signed the URL
 */
async function storeSignedUpload(
  c: Context,
  bucketConfig: Bucket,
  params: SignedUploadParams
): Promise<Response> {
  const { path, contentType, maxSize, bucket, uploadedBy } = params
  const requestType = c.req.header('content-type')?.split(';')[0]?.trim() ?? ''

  if (!uploadTypeAllowed(bucketConfig, contentType, requestType)) {
    return c.json(storageErrorBody('Content type not allowed', 'BAD_REQUEST'), 400)
  }

  const body = new Uint8Array(await c.req.arrayBuffer())
  if (body.byteLength > maxSize) {
    return payloadTooLarge(c, 'Upload exceeds the maximum allowed size')
  }

  // Signing refused a stored key; the key may have been taken since.
  if (await objectStoredAt(c, path, bucket)) return objectAlreadyStored(c)

  const mimeType = requestType !== '' ? requestType : inferMimeFromKey(path)
  const upload = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.upload(path, body, mimeType, { bucket, uploadedById: uploadedBy })
  })
  const result = await Effect.runPromise(provideDomain(c, upload).pipe(Effect.result))
  if (result._tag === 'Failure') {
    // A token names bucket and path independently, so a caller who may sign here
    // can aim one at a key another bucket owns. Storage refuses that write as
    // not-found; answer 404 like an absent key, keeping the boundary hidden (S1).
    const missing = isNotFoundError((result.failure as { readonly cause?: unknown }).cause)
    return missing
      ? notFound(c, 'File not found')
      : c.json(storageErrorBody('Upload failed', 'STORAGE_ERROR'), 500)
  }
  return c.json({ success: true, path })
}

/**
 * Handle PUT /api/buckets/:bucketName/signed.
 *
 * Stores a file uploaded via a signed upload URL. Verifies the HMAC token and
 * expiry, enforces the token-bound `contentType` and `maxSize` constraints,
 * then writes the request body through the `StorageService` — no session is
 * required, the token is the proof of authorization.
 *
 * - Tampered / expired token → 403
 * - Wrong `Content-Type` vs. the bound constraint → 400
 * - Body larger than the bound `maxSize` → 413
 * - Stored successfully → 200
 */
export function createHandleSignedUpload(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    const bucket = resolveSignBucket(app, bucketName)
    if (!bucket || bucketName === undefined) {
      return notFound(c, 'Bucket not found')
    }

    const verified = verifySignedUpload(c, bucketName)
    if (verified instanceof Response) return verified

    return storeSignedUpload(c, bucket, verified)
  }
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
async function streamSignedDownload(c: Context, path: string, bucket: string): Promise<Response> {
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
 * The one sign-permission gate shared by the single and the batch form: the
 * caller must pass {@link canSignBucketUrl} for EVERY operation asked. Returns the
 * refusal to send, or `undefined` when the caller may sign.
 *
 * An anonymous caller has no role — `canSignBucketUrl` admits them only for the
 * literal `'all'`, which is why the session check is a FALLBACK for a
 * permission that cannot be satisfied anonymously and not a precondition for
 * consulting permissions at all. Gating first made the `'all'` branch
 * unreachable.
 *
 * Anonymous → 401 (auth gate). Authenticated but refused → 404, so the
 * bucket's sign-permission boundary is not discoverable (S1).
 */
export async function refuseUnlessSignable(
  c: Context,
  app: App,
  bucket: Bucket,
  operations: readonly ('download' | 'upload')[]
): Promise<Response | undefined> {
  const session = getSessionContext(c)
  const userRole = session ? await runDomainPromise(c, getUserRole(session.userId)) : undefined
  if (operations.every((operation) => canSignBucketUrl(bucket, operation, userRole, app)))
    return undefined
  return session
    ? notFound(c, 'Resource not found')
    : c.json(storageErrorBody('Unauthorized', 'UNAUTHORIZED'), 401)
}

/**
 * Download URLs must reference an existing file; upload URLs must not — a
 * signed upload writes a NEW object. The refusal, or `undefined`.
 */
async function refuseByStoredObject(
  c: Context,
  operation: 'download' | 'upload',
  path: string,
  bucket: string
): Promise<Response | undefined> {
  if (operation === 'download') {
    return (await fileExists(c, path, bucket)) ? undefined : notFound(c, 'File not found')
  }
  return (await objectStoredAt(c, path, bucket)) ? objectAlreadyStored(c) : undefined
}

/**
 * Build the signed-URL response for an already permission-checked request, or
 * an error response. Extracted from {@link createHandleSign} to keep that
 * handler under the per-function complexity threshold.
 */
async function buildSignResponse(
  c: Context,
  bucket: Bucket,
  operation: 'download' | 'upload',
  body: SignRequestBody
): Promise<Response> {
  const bucketName = bucket.name
  const { path } = body
  if (typeof path !== 'string' || path.length === 0) {
    return c.json(storageErrorBody('Missing path', 'BAD_REQUEST'), 400)
  }

  const expiresInSeconds = resolveExpiresIn(body.expiresIn)
  if (expiresInSeconds === undefined) {
    return c.json(storageErrorBody('Invalid expiresIn value', 'BAD_REQUEST'), 400)
  }

  // Upload URLs carry HMAC-bound contentType / maxSize constraints, clamped
  // to the bucket, and the signer the object will be attributed to.
  const constraints = constraintsForSign(operation, body, {
    bucket,
    uploadedBy: getSessionContext(c)?.userId,
  })
  if (constraints === 'invalid' || constraints === 'type-not-allowed') {
    return c.json(storageErrorBody(constraintRefusalMessage(constraints), 'BAD_REQUEST'), 400)
  }

  const refusal = await refuseByStoredObject(c, operation, path, bucketName)
  if (refusal) return refusal

  const { signedUrl, expiresAt } = buildSignedUrl({
    c,
    bucket: bucketName,
    path,
    operation,
    expiresInSeconds,
    constraints,
  })
  return c.json({ success: true, signedUrl, expiresAt, operation })
}

/**
 * Handle POST /api/buckets/:bucketName/sign.
 *
 * Generates a single signed download or upload URL for one path, gated by the
 * bucket's `permissions.sign` / `permissions.signUpload` RBAC configuration.
 *
 * - Unknown bucket → 404
 * - Caller not matching the bucket's sign permission → 404, never 403 (S1
 *   anti-enumeration: the permission boundary must not be discoverable)
 * - `operation: 'upload'` → always 200 (the file need not exist yet)
 * - `operation: 'download'` (default) → 200 when the file exists, 404 when not
 */
export function createHandleSign(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    const bucket = resolveSignBucket(app, bucketName)
    if (!bucket || bucketName === undefined) {
      return notFound(c, 'Bucket not found')
    }

    const body = (await c.req.json().catch(() => ({}))) as SignRequestBody
    const operation = body.operation === 'upload' ? 'upload' : 'download'

    const refusal = await refuseUnlessSignable(c, app, bucket, [operation])
    if (refusal) return refusal

    return buildSignResponse(c, bucket, operation, body)
  }
}
