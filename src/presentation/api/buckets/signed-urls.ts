/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { resolveStorageSigningSecret } from '@/application/use-cases/storage/signing-secret'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { inferMimeFromKey, isInlineSafeImageKey } from '@/domain/kernel/identity/mime-types'
import {
  ADMIN_ONLY_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
} from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { signSignedUrl, verifySignedUrl } from '@/domain/models/app/buckets/signed-url-service'
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

/** Default signed-URL lifetime in seconds (1 hour). */
const DEFAULT_EXPIRES_IN = 3600

/** Minimum / maximum allowed `expiresIn` (60s to 7 days). */
const MIN_EXPIRES_IN = 60
const MAX_EXPIRES_IN = 604_800

/** Default upload size limit when `maxSize` is not specified (10 MB). */
const DEFAULT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

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

/**
 * Optional upload constraints baked into an upload signed URL: the allowed
 * `contentType` (empty string means "any") and the `maxSize` in bytes. Both
 * are HMAC-bound so a client cannot relax them by editing the query string.
 */
export interface UploadConstraints {
  readonly contentType: string
  readonly maxSize: number
}

/**
 * The token for one set of claims, signed with the storage secret through the
 * one shared signer (the record enricher mints with it too).
 */
function computeToken(claims: SignedUrlClaims): string {
  return signSignedUrl(signingSecret(), claims)
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
 * Build the absolute signed URL for one path. Derives the origin from the
 * incoming request so the URL round-trips against the same server. Upload
 * URLs carry their HMAC-bound `ct` (content type) and `max` (size limit)
 * constraints in the query string so the PUT handler can enforce them.
 */
export function buildSignedUrl(spec: SignedUrlSpec): {
  readonly signedUrl: string
  readonly expiresAt: string
} {
  const { c, bucket, path, operation, expiresInSeconds, constraints } = spec
  const expires = Date.now() + expiresInSeconds * 1000
  const token = computeToken({ bucket, path, operation, expires, constraints })
  const { origin } = new URL(c.req.url)
  const params = new URLSearchParams({
    path,
    op: operation,
    expires: String(expires),
    token,
  })
  if (operation === 'upload' && constraints) {
    params.set('ct', constraints.contentType)
    params.set('max', String(constraints.maxSize))
  }
  return {
    signedUrl: `${origin}/api/buckets/${bucket}/signed?${params.toString()}`,
    expiresAt: new Date(expires).toISOString(),
  }
}

/**
 * Normalize and validate a per-file `expiresIn`. Returns the value to use, or
 * `undefined` when the request specified an out-of-range value.
 */
export function resolveExpiresIn(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return DEFAULT_EXPIRES_IN
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  if (raw < MIN_EXPIRES_IN || raw > MAX_EXPIRES_IN) return undefined
  return raw
}

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

/** Parameters for a verified signed-upload request. */
interface SignedUploadParams {
  readonly bucket: string
  readonly path: string
  readonly token: string
  readonly expires: number
  readonly contentType: string
  readonly maxSize: number
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
    constraints: { contentType, maxSize },
  }
  if (!tokenVerifies(claims, token)) {
    return c.json(storageErrorBody('Invalid signature', 'FORBIDDEN'), 403)
  }
  if (Date.now() > expires) {
    return c.json(storageErrorBody('Signed URL expired', 'FORBIDDEN'), 403)
  }

  return { bucket: bucketName, path, token, expires, contentType, maxSize }
}

/**
 * Enforce the token-bound `contentType` / `maxSize` constraints and write the
 * verified upload to storage. Extracted from {@link createHandleSignedUpload}
 * to keep that handler under the per-function complexity threshold.
 *
 * - Wrong `Content-Type` vs. the bound constraint → 400
 * - Body larger than the bound `maxSize` → 413
 * - Storage write failure → 500
 * - Stored successfully → 200
 */
async function storeSignedUpload(c: Context, params: SignedUploadParams): Promise<Response> {
  const { path, contentType, maxSize, bucket } = params
  const requestType = c.req.header('content-type')?.split(';')[0]?.trim() ?? ''

  // contentType constraint (empty string means "any type allowed").
  if (contentType !== '' && requestType !== contentType) {
    return c.json(storageErrorBody('Content type not allowed', 'BAD_REQUEST'), 400)
  }

  const body = new Uint8Array(await c.req.arrayBuffer())
  if (body.byteLength > maxSize) {
    return payloadTooLarge(c, 'Upload exceeds the maximum allowed size')
  }

  const mimeType = requestType !== '' ? requestType : inferMimeFromKey(path)
  const upload = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.upload(path, body, mimeType, bucket)
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
    if (!resolveSignBucket(app, bucketName) || bucketName === undefined) {
      return notFound(c, 'Bucket not found')
    }

    const verified = verifySignedUpload(c, bucketName)
    if (verified instanceof Response) return verified

    return storeSignedUpload(c, verified)
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
 * Build a safe Content-Disposition header value. ASCII-only names use the
 * simple `filename=` parameter; names with non-ASCII characters use RFC 5987
 * `filename*=UTF-8''<percent-encoded>` to avoid a TypeError from raw multi-byte
 * characters in header values.
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
  if (/^[\x20-\x7E]*$/.test(filename)) {
    return `${disposition}; filename="${filename}"`
  }
  return `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`
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
 * Resolve the bucket config for a signed-URL request: a declared bucket, or the
 * built-in private `system` bucket.
 */
export function resolveSignBucket(app: App, bucketName: string | undefined): Bucket | undefined {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  return bucketName === SYSTEM_BUCKET_NAME ? { name: SYSTEM_BUCKET_NAME, public: false } : undefined
}

/**
 * Decide whether a user with `userRole` may perform the signing `operation`
 * on `bucket`. The permission entry is `permissions.sign` for download URLs
 * and `permissions.signUpload` for upload URLs. When the relevant permission
 * is not declared the default is admin-only.
 *
 * An admin-equivalent caller always passes (admin override): the built-in
 * `admin` and the app's top role. Unauthenticated users (`userRole` is
 * `undefined`) only pass when the permission is the literal `'all'`.
 */
function canSign(
  bucket: Bucket,
  operation: 'download' | 'upload',
  userRole: string | undefined,
  app: App
): boolean {
  const permission =
    operation === 'upload' ? bucket.permissions?.signUpload : bucket.permissions?.sign
  // The admin override and the admin-only default both admit every
  // admin-equivalent caller: the built-in `admin` and the app's top role.
  const caller =
    userRole === undefined
      ? undefined
      : { role: userRole, adminEquivalent: isAdminEquivalent(userRole, app) }
  return permits(
    evaluatePermission(permission, caller, {
      whenUndeclared: ADMIN_ONLY_WHEN_UNDECLARED,
      adminOverride: 'admin-outranks-role-list',
    })
  )
}

/**
 * The one sign-permission gate shared by the single and the batch form: the
 * caller must pass {@link canSign} for EVERY operation asked. Returns the
 * refusal to send, or `undefined` when the caller may sign.
 *
 * An anonymous caller has no role — `canSign` admits them only for the
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
  if (operations.every((operation) => canSign(bucket, operation, userRole, app))) return undefined
  return session
    ? notFound(c, 'Resource not found')
    : c.json(storageErrorBody('Unauthorized', 'UNAUTHORIZED'), 401)
}

/** Parsed body of a single-sign request. */
interface SignRequestBody {
  readonly path?: unknown
  readonly operation?: unknown
  readonly expiresIn?: unknown
  readonly contentType?: unknown
  readonly maxSize?: unknown
}

/**
 * Resolve the upload constraints for a sign request body. Returns the
 * constraints to bake into the upload token, or `undefined` when the request
 * specified an invalid `maxSize`. A missing `maxSize` defaults to 10 MB; a
 * missing `contentType` means "any type" (the empty string).
 */
function resolveUploadConstraints(body: SignRequestBody): UploadConstraints | undefined {
  const { contentType, maxSize } = body
  if (contentType !== undefined && typeof contentType !== 'string') return undefined
  if (maxSize === undefined || maxSize === null) {
    return {
      contentType: typeof contentType === 'string' ? contentType : '',
      maxSize: DEFAULT_UPLOAD_MAX_SIZE,
    }
  }
  if (typeof maxSize !== 'number' || !Number.isFinite(maxSize) || maxSize <= 0) return undefined
  return { contentType: typeof contentType === 'string' ? contentType : '', maxSize }
}

/**
 * Resolve the upload constraints for an upload sign request. Download requests
 * carry no constraints (`undefined`). Returns the literal string `'invalid'`
 * when an upload request specified an out-of-range `maxSize`.
 */
export function constraintsForSign(
  operation: 'download' | 'upload',
  body: SignRequestBody
): UploadConstraints | undefined | 'invalid' {
  if (operation !== 'upload') return undefined
  return resolveUploadConstraints(body) ?? 'invalid'
}

/**
 * Build the signed-URL response for an already permission-checked request, or
 * an error response. Extracted from {@link createHandleSign} to keep that
 * handler under the per-function complexity threshold.
 */
async function buildSignResponse(
  c: Context,
  bucketName: string,
  operation: 'download' | 'upload',
  body: SignRequestBody
): Promise<Response> {
  const { path } = body
  if (typeof path !== 'string' || path.length === 0) {
    return c.json(storageErrorBody('Missing path', 'BAD_REQUEST'), 400)
  }

  const expiresInSeconds = resolveExpiresIn(body.expiresIn)
  if (expiresInSeconds === undefined) {
    return c.json(storageErrorBody('Invalid expiresIn value', 'BAD_REQUEST'), 400)
  }

  // Upload URLs carry HMAC-bound contentType / maxSize constraints.
  const constraints = constraintsForSign(operation, body)
  if (constraints === 'invalid') {
    return c.json(storageErrorBody('Invalid maxSize value', 'BAD_REQUEST'), 400)
  }

  // Download URLs must reference an existing file; upload URLs need not.
  if (operation === 'download' && !(await fileExists(c, path, bucketName))) {
    return notFound(c, 'File not found')
  }

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

    return buildSignResponse(c, bucketName, operation, body)
  }
}
