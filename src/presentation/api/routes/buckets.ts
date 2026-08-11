/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- bucket route handlers form a single cohesive surface (upload, download, transform, delete, signed URLs); splitting fragments the auth / cache / storage-error handling that's already linear in the file */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  isFilePublic,
  resolveStoragePublicAccess,
} from '@/domain/models/env/storage/storage-public-access'
import {
  classifyPermissionRung,
  evaluatePermission,
  grantWhenUndeclared,
  permits,
  SESSION_WITH_UNRESOLVED_ROLE,
} from '@/domain/models/shared/permission-evaluation'
import {
  buildTransformCacheKey,
  buildTransformETag,
} from '@/domain/services/image-transform/image-transform-cache-key'
import {
  hasTransformParams,
  defaultTransformParams,
} from '@/domain/services/image-transform/image-transform-params'
import {
  parsePresetEnv,
  resolvePresetTransform,
} from '@/domain/services/image-transform/image-transform-presets'
import { inferMimeFromKey, isImageKey } from '@/domain/utils/mime-types'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import {
  applyImageTransform,
  mimeForFormat,
  resolveTransformOutputFormat,
} from '@/infrastructure/storage/apply-image-transform'
import {
  evictTransformCacheForKey,
  getCachedTransform,
  setCachedTransform,
} from '@/infrastructure/storage/transform-cache'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import {
  createHandleBatchSign,
  createHandleSign,
  createHandleSignedServe,
  createHandleSignedUpload,
} from '@/presentation/api/routes/buckets/signed-urls'
import { buildUploadStorageKey } from '@/presentation/api/routes/buckets/upload-key'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { isNotFoundError } from '@/presentation/api/utils/error-sanitizer'
import type { UserSession } from '@/application/ports/models/user-session'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { BucketFileAction } from '@/domain/models/app/buckets/permissions'
import type { TransformParams } from '@/domain/services/image-transform/image-transform-params'
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
    // Use the same resolution as upload — falls back to an implicit private
    // `default` bucket so apps without an explicit `buckets[]` config still work.
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    const key = c.req.param('filename')
    if (!key) {
      return c.json({ success: false, error: 'Missing filename', code: 'BAD_REQUEST' }, 400)
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
      const allowed = await canAct(bucket, 'download', session, session !== undefined)
      if (!allowed) {
        // 404 for BOTH the anonymous and the wrong-role denial: `GET` is the
        // enumeration surface, so it must never distinguish "absent" from
        // "forbidden" (S1 — [internal ref] sets the anonymous half).
        return c.json(
          {
            success: false,
            message: 'Resource not found',
            code: 'NOT_FOUND',
          },
          404
        )
      }
    }

    return serveTransformedDownload(c, key)
  }
}

/**
 * Resolve any on-the-fly image transform request for a bucket download and
 * stream the result. Handles `?width=&height=&fit=&crop=&format=&quality=`
 * plus the named `?preset=` shorthand (resolved from the operator-controlled
 * `STORAGE_TRANSFORM_PRESETS` env var).
 *
 * Invalid transform parameters (a focal point outside 0-100, an unsupported
 * `format`, an unknown preset name, or a `?preset=` with no presets configured)
 * are rejected with HTTP 400 before the storage lookup runs. Even without
 * explicit transform params, an image download may still be transcoded by
 * `Accept`-header format negotiation, so the default-params path always runs.
 */
async function serveTransformedDownload(c: Context, key: string): Promise<Response> {
  const query = c.req.query()
  const hasPreset = query['preset'] !== undefined && query['preset'] !== ''
  if (!hasPreset && !hasTransformParams(query)) {
    return serveFileDownload(c, key, defaultTransformParams())
  }

  const presets = parsePresetEnv(process.env['STORAGE_TRANSFORM_PRESETS'])
  // A preset-env parse error is an operator misconfiguration — the server
  // startup path rejects it, so by the time a
  // request runs the env is known-valid. Defensive 400 keeps types total.
  const parsed = presets.ok
    ? resolvePresetTransform(query, presets.presets)
    : { ok: false as const, error: presets.error }
  if (!parsed.ok) {
    return c.json({ success: false, error: parsed.error, code: 'BAD_REQUEST' }, 400)
  }
  // Explicit transform params (e.g. `?width=`) only apply to images.
  // Reject non-image files up front with HTTP 400 — a PDF or text file
  // cannot be resized/transcoded, so the request is a client error.
  if (!isImageKey(key)) {
    return c.json(
      {
        success: false,
        error: 'Transform parameters can only be applied to image files',
        code: 'BAD_REQUEST',
      },
      400
    )
  }
  return serveFileDownload(c, key, parsed.params)
}

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
const TRANSFORM_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * Build the final HTTP response for a transformed download from the cached
 * bytes + metadata, attaching the long-term `Cache-Control` and content
 * `ETag` headers. The same shape is used whether the bytes came from the
 * transform cache or were just produced.
 */
function buildTransformResponse(
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
 * Stream a file's bytes back to the client via the configured StorageService.
 * Returns 404 when the underlying adapter signals not-found, otherwise 500.
 * Content-Type is derived from the original filename suffix in the key
 * (the upload handler stores keys as `<uuid>-<original-filename>`).
 *
 * The downloaded image bytes are passed through the on-the-fly image transform
 * pipeline (resize + crop + format negotiation). The transform is graceful:
 * if it cannot be applied the original bytes are served unchanged.
 *
 * Transform results are cached in an in-memory LRU cache keyed by the storage
 * key + transform params + negotiated output format. The first request runs
 * the Sharp pipeline; identical subsequent requests are served from the cache.
 * Every transform response carries a long-term `Cache-Control` header and a
 * content `ETag`; a request whose `If-None-Match` matches the ETag is answered
 * with `304 Not Modified` before any storage lookup runs.
 */
async function serveFileDownload(
  c: Context,
  key: string,
  transform: TransformParams
): Promise<Response> {
  const acceptHeader = c.req.header('Accept')
  const resolvedFormat = resolveTransformOutputFormat(transform, acceptHeader)
  const cacheKey = buildTransformCacheKey(key, transform, resolvedFormat)
  const etag = buildTransformETag(cacheKey)

  // Conditional request: a matching `If-None-Match` short-circuits to 304
  // without touching storage or re-running the transform.
  if (c.req.header('If-None-Match') === etag) {
    return c.body(
      // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 304
      null,
      304,
      { 'Cache-Control': TRANSFORM_CACHE_CONTROL, ETag: etag }
    )
  }

  // Cache hit: serve the previously transformed bytes directly.
  const hit = getCachedTransform(cacheKey)
  if (hit !== undefined) {
    return buildTransformResponse(key, hit)
  }

  // Cache miss: download from storage, transform, cache, and respond.
  return produceTransformResponse(c, key, transform, { cacheKey, etag, acceptHeader })
}

/**
 * Cache-miss path of {@link serveFileDownload}: download the source bytes from
 * storage, run the on-the-fly image transform, populate the transform cache,
 * and build the HTTP response. Extracted so `serveFileDownload` stays under
 * the per-function statement limit.
 *
 * `applyImageTransform` never throws — it degrades to the original bytes if
 * Sharp is unavailable or the input is not a decodable image. The `Accept`
 * header drives format negotiation when no explicit `format` was supplied.
 */
async function produceTransformResponse(
  c: Context,
  key: string,
  transform: TransformParams,
  ctx: { readonly cacheKey: string; readonly etag: string; readonly acceptHeader?: string }
): Promise<Response> {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.download(key)
  })

  const result = await runRequestEffect(c, program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    // Single canonical "is 404?" — see `isNotFoundError` for the patterns
    // covered (S3 NoSuchKey, local ENOENT, bytea "File not found", etc.).
    const isNotFound = isNotFoundError(cause)
    if (!isNotFound) {
      logError('[buckets] download (transform path) failed', result.left)
    }
    return c.json(
      {
        success: false,
        error: isNotFound ? 'File not found' : `Download failed: ${message}`,
        code: isNotFound ? 'NOT_FOUND' : 'STORAGE_ERROR',
      },
      isNotFound ? 404 : 500
    )
  }

  const transformed = await applyImageTransform(result.right, transform, ctx.acceptHeader)
  // When the transform produced a concrete output format the Content-Type
  // reflects that format; otherwise fall back to the stored filename suffix.
  const contentType = transformed.format ? mimeForFormat(transformed.format) : inferMimeFromKey(key)
  const cached = { bytes: transformed.bytes, contentType, etag: ctx.etag }

  // Populate the cache so identical subsequent requests skip the transform.
  setCachedTransform(ctx.cacheKey, cached)

  return buildTransformResponse(key, cached)
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
 * Resolve the bucket for an upload request, falling back to an implicit
 * 'default' bucket when no explicit configuration is found.
 *
 * The implicit default bucket is private (`public: false`) when the app
 * declares an `auth` block — uploads then require a session. When the app
 * has no auth configured there is no session system to gate against, so
 * the implicit default bucket is public, allowing anonymous uploads (used
 * by page-component forms with file-upload fields).
 */
function resolveUploadBucket(app: App, bucketName: string | undefined): Bucket | undefined {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  return bucketName === 'default' ? { name: 'default', public: !app.auth } : undefined
}

/**
 * Decide whether the caller may perform `action` on `bucket`.
 *
 * Mirrors `canSign` (`buckets/signed-urls.ts`) with one deliberate inversion:
 * an UNDECLARED permission falls back to `undeclaredGrant` — the gate the
 * platform applies by default — rather than to signing's admin-only default.
 * Inheriting
 * that default here would lock every app that never wrote a `permissions` block
 * out of its own storage, because `createAuthenticatedUser()` resolves to
 * `member` ([internal ref]; `[internal ref]` is the guard).
 *
 * Admin always passes a declared role list (admin override), exactly as in
 * `canSign`. An anonymous caller passes only the literal `'all'`.
 *
 * The caller's role is resolved ONLY for a role array: `'all'`, `'authenticated'`
 * and undeclared are all decidable from session presence. `GET` on a bucket file
 * backs every image on every page, so a `getUserRole` round-trip on that path
 * would be a per-image database query.
 */
async function canAct(
  bucket: Bucket,
  action: BucketFileAction,
  session: UserSession | undefined,
  undeclaredGrant: boolean
): Promise<boolean> {
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
  const role = await getUserRole(session.userId)
  return permits(evaluatePermission(permission, { role }, policy))
}

/**
 * The gate a WRITE (upload / delete) falls back to when the bucket declares no
 * permission for it: a session is required.
 *
 * `public: true` governs READS only — it grants nothing on `POST`/`DELETE`
 *. The one exception is an app with no `auth` block at all: there
 * is no session system to gate against, so a public bucket (including the
 * implicit `default`, which resolves to `public: !app.auth`) stays anonymously
 * writable. That carve-out is what keeps page-component file-upload forms
 * working on a no-auth app; it is bounded on purpose, and a DECLARED bucket
 * without `public: true` stays unwritable there ([internal ref],
 * `[internal ref]` pins both halves).
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
  return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

/**
 * Validate the filename against path traversal and null byte injection attacks.
 * Returns an error descriptor when the filename is unsafe, undefined otherwise.
 */
function validateUploadFilename(
  name: string
): { readonly error: string; readonly code: string } | undefined {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return {
      error: 'Invalid filename: path traversal sequences are not allowed',
      code: 'BAD_REQUEST',
    }
  }
  if (name.includes('\x00')) {
    return {
      error: 'Invalid filename: null bytes are not allowed',
      code: 'BAD_REQUEST',
    }
  }
  return undefined
}

/**
 * Validate an explicit upload `path` (the storage key the file is stored at,
 * verbatim, with no UUID prefix). Unlike a filename, a path may contain `/`
 * segment separators — that is the whole point of the `STORAGE_PUBLIC_PATHS`
 * prefix feature. Path-traversal (`..`), null bytes, and a leading `/` are
 * still rejected.
 */
function validateUploadPath(
  path: string
): { readonly error: string; readonly code: string } | undefined {
  if (path.length === 0 || path.startsWith('/')) {
    return { error: 'Invalid path: must be a non-empty relative path', code: 'BAD_REQUEST' }
  }
  if (path.includes('..') || path.includes('\\')) {
    return {
      error: 'Invalid path: path traversal sequences are not allowed',
      code: 'BAD_REQUEST',
    }
  }
  if (path.includes('\x00')) {
    return { error: 'Invalid path: null bytes are not allowed', code: 'BAD_REQUEST' }
  }
  return undefined
}

/**
 * Returns true if the file's MIME type is allowed by the bucket configuration.
 * When the bucket does not constrain MIME types, all types are allowed.
 */
function isMimeTypeAllowed(bucket: Bucket, mimeType: string): boolean {
  const allowed = bucket.allowedMimeTypes
  if (!allowed || allowed.length === 0) return true
  return allowed.some((entry) =>
    entry.endsWith('/*') ? mimeType.startsWith(entry.slice(0, -1)) : mimeType === entry
  )
}

type UploadValidationFailure = {
  readonly status: 400 | 413
  readonly body: {
    readonly success: false
    readonly error: string
    readonly code: string
  }
}

/**
 * Default 100MB when no env var or bucket-level limit is configured.
 */
const DEFAULT_MAX_FILE_SIZE = 104_857_600

/**
 * Resolve the effective max file size: bucket-level limit takes precedence,
 * else fall back to the STORAGE_MAX_FILE_SIZE env var, else the 100MB default.
 * Returns the limit + which "tier" produced it so the error message stays
 * specific ("bucket" vs "global").
 */
const resolveMaxFileSize = (
  bucket: Bucket
): { readonly limit: number; readonly tier: 'bucket' | 'global' } | undefined => {
  if (bucket.maxFileSize !== undefined) return { limit: bucket.maxFileSize, tier: 'bucket' }
  const globalMaxEnv = process.env['STORAGE_MAX_FILE_SIZE']
  const globalMax = globalMaxEnv ? parseInt(globalMaxEnv, 10) : DEFAULT_MAX_FILE_SIZE
  if (!Number.isFinite(globalMax) || globalMax <= 0) return undefined
  return { limit: globalMax, tier: 'global' }
}

const fileTooLarge = (size: number, limit: number, tier: string): UploadValidationFailure => ({
  status: 413,
  body: {
    success: false,
    error: `File size ${size} bytes exceeds ${tier} limit of ${limit} bytes`,
    code: 'PAYLOAD_TOO_LARGE',
  },
})

/**
 * Run all pre-authentication validations against the uploaded file.
 * Returns a failure descriptor when validation fails, undefined otherwise.
 */
function validateUploadFile(bucket: Bucket, file: File): UploadValidationFailure | undefined {
  const filenameError = validateUploadFilename(file.name)
  if (filenameError) return { status: 400, body: { success: false, ...filenameError } }

  const sizeLimit = resolveMaxFileSize(bucket)
  if (sizeLimit) {
    const exceedsBucket = sizeLimit.tier === 'bucket' && file.size > sizeLimit.limit
    const exceedsGlobal = sizeLimit.tier === 'global' && file.size >= sizeLimit.limit
    if (exceedsBucket || exceedsGlobal) {
      return fileTooLarge(file.size, sizeLimit.limit, sizeLimit.tier)
    }
  }

  if (!isMimeTypeAllowed(bucket, file.type)) {
    return {
      status: 400,
      body: {
        success: false,
        error: `File type '${file.type}' is not allowed. Allowed types: ${(bucket.allowedMimeTypes ?? []).join(', ')}`,
        code: 'BAD_REQUEST',
      },
    }
  }

  return undefined
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
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    // Parse multipart body to access file metadata
    const body = await c.req.parseBody()
    const { file } = body
    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: 'No file provided', code: 'BAD_REQUEST' }, 400)
    }

    // Run all pre-authentication file validations (filename, size, MIME)
    const failure = validateUploadFile(bucket, file)
    if (failure) {
      return c.json(failure.body, failure.status)
    }

    // Optional `path` field: store the file at an explicit key (verbatim, no
    // UUID prefix). Enables path-prefixed keys like `public/logo.png` that the
    // STORAGE_PUBLIC_PATHS toggle matches against.
    const explicitPath = typeof body['path'] === 'string' ? body['path'] : undefined
    if (explicitPath !== undefined) {
      const pathError = validateUploadPath(explicitPath)
      if (pathError) {
        return c.json({ success: false, ...pathError }, 400)
      }
    }

    // Permission gate — deliberately AFTER the validations above, so the 400 /
    // 413 rejections stay reachable without a session.
    const session = getSessionContext(c)
    if (!(await canAct(bucket, 'upload', session, defaultWriteGrant(app, bucket, session)))) {
      return denyWrite(c, session)
    }

    return persistUpload(c, file, explicitPath)
  }
}

/**
 * Persist a validated upload via the configured `StorageService` and return
 * the HTTP response. Extracted from `createHandlePostBucketFile` to keep that
 * handler under the complexity / line-count thresholds.
 */
async function persistUpload(c: Context, file: File, explicitPath?: string): Promise<Response> {
  const arrayBuffer = await file.arrayBuffer()
  const content = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'
  // An explicit `path` is stored verbatim (enables path-prefixed public keys);
  // otherwise a random per-upload key avoids filename collisions while keeping
  // the human-readable filename as a suffix for debugging convenience (shared
  // `<uuid>-<filename>` convention — see {@link buildUploadStorageKey}).
  const key = explicitPath ?? buildUploadStorageKey(file.name)

  const quotaResponse = await checkStorageQuota(c, content.length)
  if (quotaResponse) return quotaResponse

  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.upload(key, content, mimeType)
  })

  const result = await runRequestEffect(c, program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    logError('[buckets] upload failed', result.left)
    return c.json(
      { success: false, error: `Upload failed: ${message}`, code: 'STORAGE_ERROR' },
      500
    )
  }

  return c.json({ success: true, key, size: content.length, mimeType, filename: file.name }, 201)
}

/**
 * If `STORAGE_MAX_TOTAL_SIZE` is set, query the StorageService for current
 * total bytes used and reject uploads that would push the total over the cap
 * (HTTP 507 Insufficient Storage). Returns `undefined` when the cap is not
 * configured or the upload fits within it.
 */
async function checkStorageQuota(c: Context, incomingSize: number): Promise<Response | undefined> {
  const maxTotalSizeEnv = process.env['STORAGE_MAX_TOTAL_SIZE']
  if (maxTotalSizeEnv === undefined || maxTotalSizeEnv === '') return undefined

  const maxTotalSize = parseInt(maxTotalSizeEnv, 10)
  if (!Number.isFinite(maxTotalSize) || maxTotalSize <= 0) return undefined

  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.getTotalBytes()
  })

  const result = await runRequestEffect(c, program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    // Quota probe failed — do not block the upload on infrastructure error;
    // the upload itself will surface any genuine connectivity issue.
    return undefined
  }

  if (result.right + incomingSize > maxTotalSize) {
    return c.json(
      {
        success: false,
        error: `Storage quota exceeded: ${result.right + incomingSize} > ${maxTotalSize} bytes`,
        code: 'QUOTA_EXCEEDED',
      },
      507
    )
  }

  return undefined
}

/**
 * Handle DELETE /api/buckets/:bucketName/files/:filename - Delete a file from a bucket
 *
 * Gated by `permissions.delete` (401 anonymous / 404 wrong-role); like upload,
 * `public: true` confers no write. Returns 204 on successful deletion, 404 if
 * the file does not exist.
 */
function createHandleDeleteBucketFile(app: App) {
  return async (c: Context) => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    const session = getSessionContext(c)
    if (!(await canAct(bucket, 'delete', session, defaultWriteGrant(app, bucket, session)))) {
      return denyWrite(c, session)
    }

    const key = c.req.param('filename')
    if (!key) {
      return c.json({ success: false, error: 'Missing filename', code: 'BAD_REQUEST' }, 400)
    }

    const program = Effect.gen(function* () {
      const storage = yield* StorageService
      // Use bracket notation to avoid false positive from drizzle/enforce-delete-with-where ESLint rule
      yield* storage['delete'](key)
    })

    const result = await runRequestEffect(c, program.pipe(provideStorageLive, Effect.either))
    if (result._tag === 'Left') {
      const { cause } = result.left as { readonly cause?: unknown }
      const isNotFound = isNotFoundError(cause)
      const message = cause instanceof Error ? cause.message : String(cause)
      if (!isNotFound) {
        logError('[buckets] delete failed', result.left)
      }
      return c.json(
        {
          success: false,
          error: isNotFound ? 'File not found' : `Delete failed: ${message}`,
          code: isNotFound ? 'NOT_FOUND' : 'STORAGE_ERROR',
        },
        isNotFound ? 404 : 500
      )
    }

    // The file is gone from storage — drop every cached transform derived from
    // its key so a later download (with or without transform params) returns
    // 404 instead of serving stale cached transformed bytes.
    evictTransformCacheForKey(key)

    // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
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
