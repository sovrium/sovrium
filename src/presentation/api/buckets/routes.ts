/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The public bucket endpoints: download, upload, delete, and the signed-URL
 * family mounted from `buckets/signed-urls.ts`.
 *
 * What lives here is the HTTP half — which bucket the path names, whether the
 * caller may act on it, what status a refusal earns, and the response cache.
 * What a request DOES lives in `@/application/use-cases/buckets`: the bucket
 * resolution policy, the pre-authentication upload rules, the storage programs
 * and the image transform. An automation `file:*` action reaches the same
 * programs without a status code anywhere in sight.
 *
 * Two things stay on this side that might look like they belong on the other,
 * and both are deliberate:
 *
 *  - the TRANSFORM CACHE (`If-None-Match` -> 304, the hit, the eviction) is an
 *    HTTP response cache keyed by an ETag, so it is response shaping. Keeping
 *    the lookup here also keeps the hot path — every image on every page — free
 *    of a root span and a request log it would otherwise pay on a cache hit;
 *  - the 404-versus-500 split on a storage failure needs `isNotFoundError`,
 *    which is a judgement about a driver's message rather than a property of
 *    the operation.
 */

import { Effect } from 'effect'
import { removeBucketFile } from '@/application/use-cases/buckets/bucket-file-programs'
import {
  resolveDownloadBucket,
  resolveUploadBucket,
} from '@/application/use-cases/buckets/resolve-bucket'
import {
  checkBucketUploadPath,
  checkUploadFile,
} from '@/application/use-cases/buckets/upload-policy'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isChatAttachmentKey } from '@/domain/kernel/identity/storage-key'
import {
  bucketPermissionNeedsRole,
  isPublicBucketFile,
  permitsBucketFileAction,
  type BucketFileCaller,
} from '@/domain/models/app/buckets/bucket-file-access-validation'
import { isSignatureNamespaceKey } from '@/domain/models/app/signatures/signature-capture-service'
import {
  isFilePublic,
  resolveStoragePublicAccess,
} from '@/domain/models/process-env/storage/storage-public-access'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import { planDownload } from '@/presentation/api/buckets/download-response'
import { deleteFailureResponse, persistUpload } from '@/presentation/api/buckets/file-writes'
import { refuseUnlessOwnerOrAdmin } from '@/presentation/api/buckets/object-ownership-gate'
import { createHandleSignedServe } from '@/presentation/api/buckets/signed-download'
import { createHandleBatchSign } from '@/presentation/api/buckets/signed-url-batch'
import { createHandleSign, createHandleSignedUpload } from '@/presentation/api/buckets/signed-urls'
import { defaultWriteGrant, deleteRefusal, denyWrite } from '@/presentation/api/buckets/write-gate'
import { acceptsUploadBody } from '@/presentation/api/middleware/request-body-limit'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { answerFailures, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import { rejectUpload } from '@/presentation/api/runtime/upload-rejection'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type {
  AuthDatabaseError,
  AuthRepository,
} from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { BucketFileAction } from '@/domain/models/app/buckets/permissions'
import type { Context, Hono } from 'hono'

/**
 * Handle GET /api/buckets/:bucketName/files/:filename - Download a file from a bucket
 *
 * For public buckets (public: true): serves the file directly (or 404 if not found).
 * For private buckets: gated by `permissions.download`, falling back to
 * "a session is required" when that action is undeclared. Every denial —
 * anonymous or wrong-role — answers 404 (S1 anti-enumeration).
 *
 * The `:filename` path param is the storage key returned by the upload handler
 * (e.g. `<uuid>-<original-filename>`).
 */
function createHandleGetBucketFile(app: App) {
  return (c: Context): Promise<Response> | Response => {
    // The upload resolution, then the engine-owned avatar bucket (`resolveDownloadBucket`).
    const bucket = resolveDownloadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return notFound(c, 'Bucket not found')
    }

    const key = c.req.param('filename')
    if (!key) {
      return c.json(storageErrorBody('Missing filename', 'BAD_REQUEST'), 400)
    }

    // A file is served without auth when the bucket is public, OR when the
    // operator's STORAGE_PUBLIC_PATHS / STORAGE_DEFAULT_ACCESS toggle marks
    // the storage key as public. Either short-circuits the read gate: the
    // documented model associates `permissions.download` with the private row,
    // so a declared `download` does not narrow a public bucket.
    if (isPublicBucketFile(bucket, isFilePublic(resolveStoragePublicAccess(process.env), key))) {
      return answerDownload(c, key, bucket.name)
    }

    // Otherwise the bucket's `permissions.download` decides, falling back to
    // the platform's long-standing "a session is required" gate when the
    // action is undeclared.
    const session = getSessionContext(c)
    return runHandlerEffect(
      c,
      answerFailures(
        c,
        Effect.gen(function* () {
          const allowed = yield* canAct({
            bucket,
            action: 'download',
            session,
            undeclaredGrant: session !== undefined,
            app,
          })
          // 404 for BOTH the anonymous and the wrong-role denial: `GET` is the
          // enumeration surface, so it must never distinguish "absent" from
          // "forbidden" (S1 — a buckets bucket spec sets the anonymous half).
          if (!allowed) return notFound(c)
          const download = planDownload(c, key, bucket.name)
          return Effect.isEffect(download) ? yield* download : download
        })
      )
    )
  }
}

/** Serve a download no gate stands before: only a cache miss runs a program. */
const answerDownload = (c: Context, key: string, bucket: string): Promise<Response> | Response => {
  const download = planDownload(c, key, bucket)
  return Effect.isEffect(download) ? runHandlerEffect(c, download) : download
}

/**
 * Decide whether the caller may perform `action` on `bucket`.
 *
 * Mirrors `canSignBucketUrl` (`domain/models/app/buckets/bucket-sign-validation.ts`) with one deliberate inversion:
 * an UNDECLARED permission falls back to `undeclaredGrant` — the gate the
 * platform applies by default — rather than to signing's admin-only default.
 * Inheriting
 * that default here would lock every app that never wrote a `permissions` block
 * out of its own storage, because `createAuthenticatedUser()` resolves to
 * `member` (the bucket-permission enforcement rule; a buckets perm spec is the guard).
 *
 * Admin always passes a declared role list (admin override), exactly as in
 * `canSignBucketUrl`. An anonymous caller passes only the literal `'all'`.
 *
 * The caller's role is resolved ONLY for a role array: `'all'`, `'authenticated'`
 * and undeclared are all decidable from session presence. `GET` on a bucket file
 * backs every image on every page, so a `getUserRole` round-trip on that path
 * would be a per-image database query.
 *
 * This gate stays in the route rather than moving to a use-case with the storage
 * programs, and the reason is mechanical: `Permission Evaluator Drift`
 * pins the computed
 * `bucket.permissions?.[action]` read to THIS file by path, deliberately, so
 * that deleting the gate cannot leave the check green. Moving it needs that
 * pin moved in the same change-set.
 */
function canAct(input: {
  readonly bucket: Bucket
  readonly action: BucketFileAction
  readonly session: UserSession | undefined
  readonly undeclaredGrant: boolean
  /** The app's role ladder: its top role outranks a role list like `admin`. */
  readonly app: App
}) {
  const { bucket, action, session, undeclaredGrant, app } = input
  const permission = bucket.permissions?.[action]
  return Effect.map(bucketCaller(permission, session), (caller) =>
    permitsBucketFileAction(permission, caller, { undeclaredGrant, app })
  )
}

/**
 * Who `session` is to a bucket rung. Every rung except a declared role array
 * is decidable from session presence alone, so the `getUserRole` round-trip is
 * deferred until the ladder will actually read the role.
 */
function bucketCaller(
  permission: Parameters<typeof bucketPermissionNeedsRole>[0],
  session: UserSession | undefined
): Effect.Effect<BucketFileCaller | undefined, AuthDatabaseError, AuthRepository> {
  if (session === undefined) return Effect.undefined
  return bucketPermissionNeedsRole(permission)
    ? Effect.map(getUserRole(session.userId), (role) => ({ role }))
    : Effect.succeed({})
}

/**
 * Handle POST /api/buckets/:bucketName/files - Upload a file to a bucket
 *
 * Enforces per-bucket maxFileSize before authentication so oversized payloads
 * are rejected early (HTTP 413) regardless of auth state.
 * Rejects filenames containing path traversal sequences (e.g. ../).
 *
 * Gated by `permissions.upload` after file validation. `public: true` never widens
 * a write: undeclared, a public bucket admits an admin only (`defaultWriteGrant`);
 * an anonymous write needs `upload: 'all'` (401 anonymous / 404 wrong-role).
 */
function createHandlePostBucketFile(app: App) {
  return async (c: Context) => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return notFound(c, 'Bucket not found')
    }

    // Parse multipart body to access file metadata
    const body = await c.req.parseBody()
    const { file } = body
    if (!file || !(file instanceof File)) {
      return c.json(storageErrorBody('No file provided', 'BAD_REQUEST'), 400)
    }

    // Pre-authentication file rules (filename, size, MIME)
    const rejection = checkUploadFile(bucket, file)
    if (rejection) return rejectUpload(c, rejection)

    // Optional `path` field: store the file at an explicit key (verbatim, no
    // UUID prefix). Enables path-prefixed keys like `public/logo.png` that the
    // STORAGE_PUBLIC_PATHS toggle matches against.
    const explicitPath = typeof body['path'] === 'string' ? body['path'] : undefined
    if (explicitPath !== undefined) {
      const pathRejection = checkBucketUploadPath(bucket, explicitPath)
      if (pathRejection) return rejectUpload(c, pathRejection)
    }

    // Permission gate — deliberately AFTER the validations above, so the 400 /
    // 413 rejections stay reachable without a session.
    const session = getSessionContext(c)
    return runHandlerEffect(
      c,
      answerFailures(
        c,
        Effect.gen(function* () {
          const allowed = yield* canAct({
            bucket,
            action: 'upload',
            session,
            undeclaredGrant: yield* defaultWriteGrant(app, bucket, session),
            app,
          })
          if (!allowed) return denyWrite(c, session)

          // An explicit `path` can name a key that already holds somebody's object:
          // replacing it is a write over THAT object, judged per object.
          const refusal = yield* refuseUnlessOwnerOrAdmin(c, {
            app,
            bucket,
            action: 'upload',
            session,
            key: explicitPath,
          })
          if (refusal) return refusal

          return yield* persistUpload(c, file, { bucket: bucket.name, session }, explicitPath)
        })
      )
    )
  }
}

/**
 * Handle DELETE /api/buckets/:bucketName/files/:filename - Delete a file from a bucket
 *
 * Gated by `permissions.delete` (`deleteRefusal`: 401 anonymous, 404 wrong role, and on an
 * app with no `auth` block the unknown key's 404); `public: true` confers no write. An
 * undeclared `delete` admits only the object's uploader or an admin: anyone else gets the
 * unknown key's 404. Returns 204 on successful deletion, 404 if the file does not exist.
 */
function createHandleDeleteBucketFile(app: App) {
  return (c: Context): Promise<Response> | Response => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return notFound(c, 'Bucket not found')
    }

    const session = getSessionContext(c)
    return runHandlerEffect(
      c,
      answerFailures(
        c,
        Effect.gen(function* () {
          const caller = yield* bucketCaller(bucket.permissions?.delete, session)
          const denied = deleteRefusal(c, { app, bucket, caller, session })
          if (denied !== undefined) return denied

          const key = c.req.param('filename')
          if (!key) {
            return c.json(storageErrorBody('Missing filename', 'BAD_REQUEST'), 400)
          }

          const refusal = yield* refuseUnlessOwnerOrAdmin(c, {
            app,
            bucket,
            action: 'delete',
            session,
            key,
          })
          if (refusal) return refusal
          // A chat attachment is deleted with its conversation only, and a file of
          // the signature namespace (evidence or a record's mark) with its own
          // retention, record or signer: here both are absent.
          if (isChatAttachmentKey(key) || isSignatureNamespaceKey(key)) {
            return notFound(c, 'File not found')
          }

          const result = yield* Effect.result(removeBucketFile({ key, bucket: bucket.name }))
          if (result._tag === 'Failure') return deleteFailureResponse(c, result.failure)

          // The file is gone from storage — drop every cached transform derived from
          // its key so a later download (with or without transform params) returns
          // 404 instead of serving stale cached transformed bytes.
          evictTransformCacheForKey(key)

          return c.body(null, 204)
        })
      )
    )
  }
}

/**
 * Chain bucket routes onto a Hono app. Provides:
 * - GET /api/buckets/:bucketName/files/:filename - Download a file (auth-gated for private buckets)
 * - POST /api/buckets/:bucketName/files - Upload a file (enforces maxFileSize, auth-gated for private buckets)
 * - DELETE /api/buckets/:bucketName/files/:filename - Delete a file (auth-gated for private buckets)
 * - POST /api/buckets/:bucketName/sign - Generate a signed download/upload URL (RBAC-gated)
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Validated application configuration
 * @returns Hono app with bucket routes chained
 */
export function chainBucketRoutes<T extends Hono>(honoApp: T, app: App): T {
  // Register DELETE via .on() to avoid false positive from drizzle/enforce-delete-with-where ESLint rule
  // `:filename{.+}` matches multi-segment storage keys (e.g. `public/logo.png`)
  // so path-prefixed public files resolve as a single `filename` param.
  const routedApp = honoApp
    .get('/api/buckets/:bucketName/files/:filename{.+}', createHandleGetBucketFile(app))
    .post('/api/buckets/:bucketName/files', acceptsUploadBody(createHandlePostBucketFile(app)))
    .on('DELETE', '/api/buckets/:bucketName/files/:filename{.+}', createHandleDeleteBucketFile(app))
    .post('/api/buckets/:bucketName/sign/batch', createHandleBatchSign(app))
    .post('/api/buckets/:bucketName/sign', createHandleSign(app))
    .get('/api/buckets/:bucketName/signed', createHandleSignedServe(app))
    .put('/api/buckets/:bucketName/signed', acceptsUploadBody(createHandleSignedUpload(app)))
  return routedApp as T
}
