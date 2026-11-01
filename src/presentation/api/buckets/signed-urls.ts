/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  readOtherSpelling,
  readStoredObjectOwner,
} from '@/application/use-cases/buckets/bucket-file-programs'
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
import { resolveStorageSigningSecret } from '@/application/use-cases/buckets/signing-secret'
import { checkBucketUploadPath } from '@/application/use-cases/buckets/upload-policy'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import {
  signedUploadResponseSchema,
  signedUrlResponseSchema,
} from '@/domain/models/api/buckets/files'
import { canSignBucketUrl } from '@/domain/models/app/buckets/bucket-sign-validation'
import { verifySignedUrl } from '@/domain/models/app/buckets/signed-url-service'
import { objectAlreadyStored, signedUploadFailure } from '@/presentation/api/buckets/file-writes'
import { fileExists } from '@/presentation/api/buckets/signed-download'
import {
  payloadTooLarge,
  storageErrorBody,
  notFound,
} from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
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
export const objectStoredAt = (path: string, bucket: string) =>
  Effect.all([readStoredObjectOwner({ key: path, bucket }), readOtherSpelling({ key: path })]).pipe(
    // effect-swallow: an unreadable catalog answers `false` here; the write that follows reads the same catalog and surfaces the outage itself.
    Effect.result,
    Effect.map((result) => {
      if (result._tag === 'Failure') return false
      const [exact, other] = result.success
      // A second spelling of an object this bucket holds is that object.
      return exact.stored || other?.bucket === bucket
    })
  )

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

  return runHandlerEffect(
    c,
    Effect.gen(function* () {
      // Signing refused a stored key; the key may have been taken since.
      if (yield* objectStoredAt(path, bucket)) return objectAlreadyStored(c)

      const mimeType = requestType !== '' ? requestType : inferMimeFromKey(path)
      const storage = yield* StorageService
      // Create-only: a file stored at the path since the check above is kept (409).
      const result = yield* Effect.result(
        storage.upload(path, body, mimeType, {
          bucket,
          uploadedById: uploadedBy,
          mode: 'create-only',
        })
      )
      if (result._tag === 'Failure') {
        // A token names bucket and path independently, so a caller who may sign here
        // can aim one at a key another bucket owns. Storage refuses that write as
        // not-found; answer 404 like an absent key, keeping the boundary hidden (S1).
        return signedUploadFailure(c, (result.failure as { readonly cause?: unknown }).cause)
      }
      return yield* respondWith(
        c,
        Effect.succeed({ success: true, path }),
        signedUploadResponseSchema
      )
    })
  )
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
export const refuseUnlessSignable = (
  c: Context,
  app: App,
  bucket: Bucket,
  operations: readonly ('download' | 'upload')[]
) =>
  Effect.gen(function* () {
    const session = getSessionContext(c)
    const userRole = session ? yield* getUserRole(session.userId) : undefined
    if (operations.every((operation) => canSignBucketUrl(bucket, operation, userRole, app))) {
      return undefined
    }
    return session
      ? notFound(c, 'Resource not found')
      : c.json(storageErrorBody('Unauthorized', 'UNAUTHORIZED'), 401)
  })

/**
 * Download URLs must reference an existing file; upload URLs must not — a
 * signed upload writes a NEW object. The refusal, or `undefined`.
 */
const refuseByStoredObject = (
  c: Context,
  operation: 'download' | 'upload',
  path: string,
  bucket: string
) =>
  operation === 'download'
    ? Effect.map(fileExists(path, bucket), (exists) =>
        exists ? undefined : notFound(c, 'File not found')
      )
    : Effect.map(objectStoredAt(path, bucket), (stored) =>
        stored ? objectAlreadyStored(c) : undefined
      )

/**
 * Build the signed-URL response for an already permission-checked request, or
 * an error response. Extracted from {@link createHandleSign} to keep that
 * handler under the per-function complexity threshold.
 */
const buildSignResponse = (
  c: Context,
  bucket: Bucket,
  operation: 'download' | 'upload',
  body: SignRequestBody
) =>
  Effect.gen(function* () {
    const bucketName = bucket.name
    const { path } = body
    if (typeof path !== 'string' || path.length === 0) {
      return c.json(storageErrorBody('Missing path', 'BAD_REQUEST'), 400)
    }
    // An upload names the key it creates, so it is held to the explicit-path rules.
    const pathRejection = operation === 'upload' ? checkBucketUploadPath(bucket, path) : undefined
    if (pathRejection) return c.json(storageErrorBody(pathRejection.message, 'BAD_REQUEST'), 400)

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

    const refusal = yield* refuseByStoredObject(c, operation, path, bucketName)
    if (refusal) return refusal

    const { signedUrl, expiresAt } = buildSignedUrl({
      c,
      bucket: bucketName,
      path,
      operation,
      expiresInSeconds,
      constraints,
    })
    return yield* respondWith(
      c,
      Effect.succeed({ success: true, signedUrl, expiresAt, operation }),
      signedUrlResponseSchema
    )
  })

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

    return runHandlerEffect(
      c,
      answerFailures(
        c,
        Effect.gen(function* () {
          const refusal = yield* refuseUnlessSignable(c, app, bucket, [operation])
          if (refusal) return refusal

          return yield* buildSignResponse(c, bucket, operation, body)
        })
      )
    )
  }
}
