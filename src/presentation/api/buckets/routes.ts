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
import {
  produceTransformedFile,
  removeBucketFile,
} from '@/application/use-cases/buckets/bucket-file-programs'
import { resolveUploadBucket } from '@/application/use-cases/buckets/resolve-bucket'
import { checkUploadFile, checkUploadPath } from '@/application/use-cases/buckets/upload-policy'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isImageKey } from '@/domain/kernel/identity/mime-types'
import { AVATAR_BUCKET_NAME, resolveAvatarBucket } from '@/domain/models/app/auth/avatar-url'
import {
  classifyPermissionRung,
  evaluatePermission,
  grantWhenUndeclared,
  permits,
  SESSION_WITH_UNRESOLVED_ROLE,
} from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  buildTransformCacheKey,
  buildTransformETag,
} from '@/domain/models/app/buckets/image-transform-cache-key'
import {
  hasTransformParams,
  defaultTransformParams,
} from '@/domain/models/app/buckets/image-transform-params'
import {
  parsePresetEnv,
  resolvePresetTransform,
} from '@/domain/models/app/buckets/image-transform-presets'
import {
  isFilePublic,
  resolveStoragePublicAccess,
} from '@/domain/models/process-env/storage/storage-public-access'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { resolveTransformOutputFormat } from '@/infrastructure/storage/apply-image-transform'
import {
  evictTransformCacheForKey,
  getCachedTransform,
  setCachedTransform,
} from '@/infrastructure/storage/transform-cache'
import {
  buildTransformResponse,
  storageFailureResponse,
  transformFailureResponse,
  TRANSFORM_CACHE_CONTROL,
} from '@/presentation/api/buckets/download-response'
import { deleteFailureResponse, persistUpload } from '@/presentation/api/buckets/file-writes'
import { refuseUnlessOwnerOrAdmin } from '@/presentation/api/buckets/object-ownership-gate'
import { createHandleSignedServe } from '@/presentation/api/buckets/signed-download'
import { createHandleBatchSign } from '@/presentation/api/buckets/signed-url-batch'
import { createHandleSign, createHandleSignedUpload } from '@/presentation/api/buckets/signed-urls'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { rejectUpload } from '@/presentation/api/runtime/upload-rejection'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { TransformParams } from '@/domain/models/app/buckets/image-transform-params'
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
  return async (c: Context) => {
    // Same resolution as upload — falls back to an implicit private `default`
    // bucket so apps without an explicit `buckets[]` config still work.
    //
    // …and then to the ENGINE-OWNED avatar bucket, for the one name the engine
    // mints URLs under itself (`POST /api/account/avatar`). Without this an
    // app declaring no bucket would store the object and hand back a URL that
    // 404s — the dead reference the upload's old 404 was avoiding.
    //
    // ORDER IS THE FENCE. `resolveUploadBucket`
    // answers FIRST, so a host that declares `avatars` keeps its own bucket and
    // every rule it wrote — its `public` flag and its `permissions.download`
    // included. The fallback is reached only when the host declared nothing, so
    // it can never narrow an app that has been serving public avatars.
    //
    // Applied to the DOWNLOAD handler only, and not inside
    // `resolveUploadBucket` itself: that resolver also serves upload, delete
    // and sign, and teaching it this name would open three write doors on a
    // bucket the host never declared.
    const bucketName = c.req.param('bucketName')
    const bucket =
      resolveUploadBucket(app, bucketName) ??
      (bucketName === AVATAR_BUCKET_NAME ? resolveAvatarBucket(app.buckets) : undefined)
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
    const publicAccess = resolveStoragePublicAccess()
    const isPublic = bucket.public || isFilePublic(publicAccess, key)
    if (!isPublic) {
      // Otherwise the bucket's `permissions.download` decides, falling back to
      // the platform's long-standing "a session is required" gate when the
      // action is undeclared.
      const session = getSessionContext(c)
      const allowed = await canAct(c, {
        bucket,
        action: 'download',
        session,
        undeclaredGrant: session !== undefined,
        app,
      })
      if (!allowed) {
        // 404 for BOTH the anonymous and the wrong-role denial: `GET` is the
        // enumeration surface, so it must never distinguish "absent" from
        // "forbidden" (S1 — a buckets bucket spec sets the anonymous half).
        return notFound(c)
      }
    }

    return serveTransformedDownload(c, key, bucket.name)
  }
}

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
async function serveTransformedDownload(
  c: Context,
  key: string,
  bucket: string
): Promise<Response> {
  const query = c.req.query()
  const hasPreset = query['preset'] !== undefined && query['preset'] !== ''
  if (!hasPreset && !hasTransformParams(query)) {
    return serveFileDownload(c, key, defaultTransformParams(), bucket)
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
async function serveFileDownload(
  c: Context,
  key: string,
  transform: TransformParams,
  bucket: string
): Promise<Response> {
  const acceptHeader = c.req.header('Accept')
  const resolvedFormat = resolveTransformOutputFormat(transform, acceptHeader)
  const cacheKey = buildTransformCacheKey(key, transform, resolvedFormat, bucket)
  const etag = buildTransformETag(cacheKey)

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
async function produceTransformResponse(
  c: Context,
  key: string,
  transform: TransformParams,
  ctx: {
    readonly cacheKey: string
    readonly etag: string
    readonly acceptHeader?: string
    readonly bucket: string
  }
): Promise<Response> {
  const result = await runRequestEffect(
    c,
    provideDomain(
      c,
      produceTransformedFile({
        key,
        bucket: ctx.bucket,
        transform,
        acceptHeader: ctx.acceptHeader,
      })
    ).pipe(Effect.result)
  )

  if (result._tag === 'Failure') {
    const { failure } = result
    return failure._tag === 'ImageTransformRejected'
      ? transformFailureResponse(c, failure.failure)
      : storageFailureResponse(c, failure, '[buckets] download (transform path) failed')
  }

  const cached = { ...result.success, etag: ctx.etag }
  // Populate the cache so identical subsequent requests skip the transform.
  setCachedTransform(ctx.cacheKey, cached)

  return buildTransformResponse(key, cached)
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
async function canAct(
  c: Context,
  input: {
    readonly bucket: Bucket
    readonly action: BucketFileAction
    readonly session: UserSession | undefined
    readonly undeclaredGrant: boolean
    /** The app's role ladder: its top role outranks a role list like `admin`. */
    readonly app: App
  }
): Promise<boolean> {
  const { bucket, action, session, undeclaredGrant, app } = input
  const permission = bucket.permissions?.[action]
  const policy = {
    whenUndeclared: grantWhenUndeclared(undeclaredGrant),
    adminOverride: 'admin-outranks-role-list',
  } as const

  // Every rung except a declared role array is decidable from session presence
  // alone, so the `getUserRole` round-trip is deferred until the ladder will
  // actually read the role.
  if (classifyPermissionRung(permission) !== 'roles') {
    const caller = session ? SESSION_WITH_UNRESOLVED_ROLE : undefined
    return permits(evaluatePermission(permission, caller, policy))
  }

  if (!session) return permits(evaluatePermission(permission, undefined, policy))
  const role = await runDomainPromise(c, getUserRole(session.userId))
  return permits(
    evaluatePermission(permission, { role, adminEquivalent: isAdminEquivalent(role, app) }, policy)
  )
}

/**
 * The gate a WRITE (upload / delete) falls back to when the bucket declares no
 * permission for it: a session is required.
 *
 * `public: true` governs READS only — it grants nothing on `POST`/`DELETE`
 * The one exception is an app with no `auth` block at all: there
 * is no session system to gate against, so a public bucket (including the
 * built-in `system` bucket, which resolves to `public: !app.auth`) stays anonymously
 * writable. That carve-out is what keeps page-component file-upload forms
 * working on a no-auth app; it is bounded on purpose, and a DECLARED bucket
 * without `public: true` stays unwritable there (the bucket-permission enforcement rule,
 * a buckets perm spec pins both halves).
 *
 * The way out of the asymmetry is the same explicit lever an auth-enabled app
 * uses: `permissions: { upload: 'all' }`.
 */
function defaultWriteGrant(app: App, bucket: Bucket, session: UserSession | undefined): boolean {
  if (bucket.public && !app.auth) return true
  return session !== undefined
}

/**
 * Denial response for a write the caller may not perform.
 *
 * Anonymous → 401: actionable for the caller, and it carries no existence
 * signal. Authenticated but refused by role → 404: a post-authentication role
 * denial WOULD leak the bucket's existence, so it drops to the read path's
 * anti-enumeration code (S1). Mirrors `createHandleSign` — the split is by
 * endpoint and deliberate, never 403.
 */
function denyWrite(c: Context, session: UserSession | undefined): Response {
  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      401
    )
  }
  return notFound(c, 'Resource not found')
}

/**
 * Handle POST /api/buckets/:bucketName/files - Upload a file to a bucket
 *
 * Enforces per-bucket maxFileSize before authentication so oversized payloads
 * are rejected early (HTTP 413) regardless of auth state.
 * Rejects filenames containing path traversal sequences (e.g. ../).
 *
 * Gated by `permissions.upload` after file validation. `public: true` grants
 * reads, never writes — an anonymous write on an auth-enabled app needs the
 * explicit `upload: 'all'` grant (401 anonymous / 404 wrong-role).
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
      const pathRejection = checkUploadPath(explicitPath)
      if (pathRejection) return rejectUpload(c, pathRejection)
    }

    // Permission gate — deliberately AFTER the validations above, so the 400 /
    // 413 rejections stay reachable without a session.
    const session = getSessionContext(c)
    if (
      !(await canAct(c, {
        bucket,
        action: 'upload',
        session,
        undeclaredGrant: defaultWriteGrant(app, bucket, session),
        app,
      }))
    ) {
      return denyWrite(c, session)
    }

    // An explicit `path` can name a key that already holds somebody's object:
    // replacing it is a write over THAT object, judged per object.
    const refusal = await refuseUnlessOwnerOrAdmin(c, {
      app,
      bucket,
      action: 'upload',
      session,
      key: explicitPath,
    })
    if (refusal) return refusal

    return persistUpload(c, file, { bucket: bucket.name, session }, explicitPath)
  }
}

/**
 * Handle DELETE /api/buckets/:bucketName/files/:filename - Delete a file from a bucket
 *
 * Gated by `permissions.delete` (401 anonymous / 404 wrong-role); like upload,
 * `public: true` confers no write. When the bucket leaves `delete` undeclared,
 * only the object's uploader or an admin may remove it, and anyone else gets
 * the unknown key's 404. Returns 204 on successful deletion, 404 if the file
 * does not exist.
 */
function createHandleDeleteBucketFile(app: App) {
  return async (c: Context) => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return notFound(c, 'Bucket not found')
    }

    const session = getSessionContext(c)
    if (
      !(await canAct(c, {
        bucket,
        action: 'delete',
        session,
        undeclaredGrant: defaultWriteGrant(app, bucket, session),
        app,
      }))
    ) {
      return denyWrite(c, session)
    }

    const key = c.req.param('filename')
    if (!key) {
      return c.json(storageErrorBody('Missing filename', 'BAD_REQUEST'), 400)
    }

    const refusal = await refuseUnlessOwnerOrAdmin(c, {
      app,
      bucket,
      action: 'delete',
      session,
      key,
    })
    if (refusal) return refusal

    const result = await runRequestEffect(
      c,
      provideDomain(c, removeBucketFile({ key, bucket: bucket.name })).pipe(Effect.result)
    )
    if (result._tag === 'Failure') return deleteFailureResponse(c, result.failure)

    // The file is gone from storage — drop every cached transform derived from
    // its key so a later download (with or without transform params) returns
    // 404 instead of serving stale cached transformed bytes.
    evictTransformCacheForKey(key)

    return c.body(null, 204)
  }
}

/**
 * Chain bucket routes onto a Hono app
 *
 * Provides:
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
    .post('/api/buckets/:bucketName/files', createHandlePostBucketFile(app))
    .on('DELETE', '/api/buckets/:bucketName/files/:filename{.+}', createHandleDeleteBucketFile(app))
    .post('/api/buckets/:bucketName/sign/batch', createHandleBatchSign(app))
    .post('/api/buckets/:bucketName/sign', createHandleSign(app))
    .get('/api/buckets/:bucketName/signed', createHandleSignedServe(app))
    .put('/api/buckets/:bucketName/signed', createHandleSignedUpload(app))
  return routedApp as T
}
