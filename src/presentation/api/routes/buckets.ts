/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { isNotFoundError } from '@/presentation/api/utils/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { Context, Hono } from 'hono'

/**
 * Handle GET /api/buckets/:bucketName/files/:filename - Download a file from a bucket
 *
 * For private buckets (public: false or omitted): returns 401 if unauthenticated.
 * For public buckets (public: true): serves the file directly (or 404 if not found).
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

    if (!bucket.public && !getSessionContext(c)) {
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

    const key = c.req.param('filename')
    if (!key) {
      return c.json({ success: false, error: 'Missing filename', code: 'BAD_REQUEST' }, 400)
    }

    return serveFileDownload(c, key)
  }
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

/**
 * Stream a file's bytes back to the client via the configured StorageService.
 * Returns 404 when the underlying adapter signals not-found, otherwise 500.
 * Content-Type is derived from the original filename suffix in the key
 * (the upload handler stores keys as `<uuid>-<original-filename>`).
 */
async function serveFileDownload(c: Context, key: string): Promise<Response> {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.download(key)
  })

  const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    // Single canonical "is 404?" — see `isNotFoundError` for the patterns
    // covered (S3 NoSuchKey, local ENOENT, bytea "File not found", etc.).
    const isNotFound = isNotFoundError(cause)
    return c.json(
      {
        success: false,
        error: isNotFound ? 'File not found' : `Download failed: ${message}`,
        code: isNotFound ? 'NOT_FOUND' : 'STORAGE_ERROR',
      },
      isNotFound ? 404 : 500
    )
  }

  // Copy bytes into a fresh ArrayBuffer-backed Uint8Array. TypeScript 6's
  // bare `Uint8Array` defaults to `Uint8Array<ArrayBufferLike>`, which is not
  // assignable to `BodyInit` (which requires `Uint8Array<ArrayBuffer>`).
  // `Uint8Array.from` produces a fresh, concrete-buffer-backed array.
  const body = Uint8Array.from(result.right)
  const mimeType = inferMimeFromKey(key)
  const originalFilename = stripUuidPrefix(key)
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': buildContentDisposition(originalFilename),
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
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
 * Best-effort MIME-type inference from the filename extension. Falls back to
 * `application/octet-stream` when the extension is unknown.
 */
function inferMimeFromKey(key: string): string {
  const ext = key.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (!ext) return 'application/octet-stream'
  const map: Record<string, string> = {
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  }
  return map[ext] ?? 'application/octet-stream'
}

/**
 * Resolve the bucket for an upload request, falling back to an implicit
 * private 'default' bucket when no explicit configuration is found.
 */
function resolveUploadBucket(app: App, bucketName: string | undefined): Bucket | undefined {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  return bucketName === 'default' ? { name: 'default', public: false } : undefined
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
 * For private buckets, requires authentication after file size validation.
 * Rejects filenames containing path traversal sequences (e.g. ../).
 */
function createHandlePostBucketFile(app: App) {
  return async (c: Context) => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    // Parse multipart body to access file metadata
    const { file } = await c.req.parseBody()
    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: 'No file provided', code: 'BAD_REQUEST' }, 400)
    }

    // Run all pre-authentication file validations (filename, size, MIME)
    const failure = validateUploadFile(bucket, file)
    if (failure) {
      return c.json(failure.body, failure.status)
    }

    // For private buckets, require authentication
    if (!bucket.public && !getSessionContext(c)) {
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

    return persistUpload(c, file)
  }
}

/**
 * Persist a validated upload via the configured `StorageService` and return
 * the HTTP response. Extracted from `createHandlePostBucketFile` to keep that
 * handler under the complexity / line-count thresholds.
 */
async function persistUpload(c: Context, file: File): Promise<Response> {
  const arrayBuffer = await file.arrayBuffer()
  const content = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'
  // Random per-upload key avoids filename collisions while keeping the
  // human-readable filename as a suffix for debugging convenience.
  const key = `${crypto.randomUUID()}-${file.name}`

  const quotaResponse = await checkStorageQuota(c, content.length)
  if (quotaResponse) return quotaResponse

  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.upload(key, content, mimeType)
  })

  const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
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

  const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
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
 * For private buckets: returns 401 if unauthenticated.
 * Returns 204 on successful deletion, 404 if the file does not exist.
 */
function createHandleDeleteBucketFile(app: App) {
  return async (c: Context) => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    if (!bucket.public && !getSessionContext(c)) {
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

    const key = c.req.param('filename')
    if (!key) {
      return c.json({ success: false, error: 'Missing filename', code: 'BAD_REQUEST' }, 400)
    }

    const program = Effect.gen(function* () {
      const storage = yield* StorageService
      // Use bracket notation to avoid false positive from drizzle/enforce-delete-with-where ESLint rule
      yield* storage['delete'](key)
    })

    const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
    if (result._tag === 'Left') {
      const { cause } = result.left as { readonly cause?: unknown }
      const isNotFound = isNotFoundError(cause)
      const message = cause instanceof Error ? cause.message : String(cause)
      return c.json(
        {
          success: false,
          error: isNotFound ? 'File not found' : `Delete failed: ${message}`,
          code: isNotFound ? 'NOT_FOUND' : 'STORAGE_ERROR',
        },
        isNotFound ? 404 : 500
      )
    }

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
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Validated application configuration
 * @returns Hono app with bucket routes chained
 */
export function chainBucketRoutes<T extends Hono>(honoApp: T, app: App): T {
  // Register DELETE via .on() to avoid false positive from drizzle/enforce-delete-with-where ESLint rule
  const routedApp = honoApp
    .get('/api/buckets/:bucketName/files/:filename', createHandleGetBucketFile(app))
    .post('/api/buckets/:bucketName/files', createHandlePostBucketFile(app))
    .on('DELETE', '/api/buckets/:bucketName/files/:filename', createHandleDeleteBucketFile(app))
  return routedApp as T
}
