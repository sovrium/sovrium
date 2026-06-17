/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  isFilePublic,
  resolveStoragePublicAccess,
} from '@/domain/models/env/storage/storage-public-access'
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
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { isNotFoundError } from '@/presentation/api/utils/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { TransformParams } from '@/domain/services/image-transform/image-transform-params'
import type { Context, Hono } from 'hono'

function createHandleGetBucketFile(app: App) {
  return async (c: Context) => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    const key = c.req.param('filename')
    if (!key) {
      return c.json({ success: false, error: 'Missing filename', code: 'BAD_REQUEST' }, 400)
    }

    const publicAccess = resolveStoragePublicAccess()
    const isPublic = bucket.public || isFilePublic(publicAccess, key)
    if (!isPublic && !getSessionContext(c)) {
      return c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      )
    }

    return serveTransformedDownload(c, key)
  }
}

async function serveTransformedDownload(c: Context, key: string): Promise<Response> {
  const query = c.req.query()
  const hasPreset = query['preset'] !== undefined && query['preset'] !== ''
  if (!hasPreset && !hasTransformParams(query)) {
    return serveFileDownload(c, key, defaultTransformParams())
  }

  const presets = parsePresetEnv(process.env['STORAGE_TRANSFORM_PRESETS'])
  const parsed = presets.ok
    ? resolvePresetTransform(query, presets.presets)
    : { ok: false as const, error: presets.error }
  if (!parsed.ok) {
    return c.json({ success: false, error: parsed.error, code: 'BAD_REQUEST' }, 400)
  }
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

function buildContentDisposition(filename: string): string {
  if (/^[\x20-\x7E]*$/.test(filename)) {
    return `attachment; filename="${filename}"`
  }
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
}

const TRANSFORM_CACHE_CONTROL = 'public, max-age=31536000, immutable'

function buildTransformResponse(
  key: string,
  cached: { readonly bytes: Uint8Array; readonly contentType: string; readonly etag: string }
): Response {
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

async function serveFileDownload(
  c: Context,
  key: string,
  transform: TransformParams
): Promise<Response> {
  const acceptHeader = c.req.header('Accept')
  const resolvedFormat = resolveTransformOutputFormat(transform, acceptHeader)
  const cacheKey = buildTransformCacheKey(key, transform, resolvedFormat)
  const etag = buildTransformETag(cacheKey)

  if (c.req.header('If-None-Match') === etag) {
    return c.body(
      null,
      304,
      { 'Cache-Control': TRANSFORM_CACHE_CONTROL, ETag: etag }
    )
  }

  const hit = getCachedTransform(cacheKey)
  if (hit !== undefined) {
    return buildTransformResponse(key, hit)
  }

  return produceTransformResponse(c, key, transform, { cacheKey, etag, acceptHeader })
}

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

  const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    const isNotFound = isNotFoundError(cause)
    if (!isNotFound) {
      console.error('[buckets] download (transform path) failed', result.left)
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
  const contentType = transformed.format ? mimeForFormat(transformed.format) : inferMimeFromKey(key)
  const cached = { bytes: transformed.bytes, contentType, etag: ctx.etag }

  setCachedTransform(ctx.cacheKey, cached)

  return buildTransformResponse(key, cached)
}

function stripUuidPrefix(key: string): string {
  const match = key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)
  return match?.[1] ?? key
}

function resolveUploadBucket(app: App, bucketName: string | undefined): Bucket | undefined {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  return bucketName === 'default' ? { name: 'default', public: !app.auth } : undefined
}

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

const DEFAULT_MAX_FILE_SIZE = 104_857_600

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

function createHandlePostBucketFile(app: App) {
  return async (c: Context) => {
    const bucket = resolveUploadBucket(app, c.req.param('bucketName'))
    if (!bucket) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    const body = await c.req.parseBody()
    const { file } = body
    if (!file || !(file instanceof File)) {
      return c.json({ success: false, error: 'No file provided', code: 'BAD_REQUEST' }, 400)
    }

    const failure = validateUploadFile(bucket, file)
    if (failure) {
      return c.json(failure.body, failure.status)
    }

    const explicitPath = typeof body['path'] === 'string' ? body['path'] : undefined
    if (explicitPath !== undefined) {
      const pathError = validateUploadPath(explicitPath)
      if (pathError) {
        return c.json({ success: false, ...pathError }, 400)
      }
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

    return persistUpload(c, file, explicitPath)
  }
}

async function persistUpload(c: Context, file: File, explicitPath?: string): Promise<Response> {
  const arrayBuffer = await file.arrayBuffer()
  const content = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'
  const key = explicitPath ?? `${crypto.randomUUID()}-${file.name}`

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
    console.error('[buckets] upload failed', result.left)
    return c.json(
      { success: false, error: `Upload failed: ${message}`, code: 'STORAGE_ERROR' },
      500
    )
  }

  return c.json({ success: true, key, size: content.length, mimeType, filename: file.name }, 201)
}

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
      yield* storage['delete'](key)
    })

    const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
    if (result._tag === 'Left') {
      const { cause } = result.left as { readonly cause?: unknown }
      const isNotFound = isNotFoundError(cause)
      const message = cause instanceof Error ? cause.message : String(cause)
      if (!isNotFound) {
        console.error('[buckets] delete failed', result.left)
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

    evictTransformCacheForKey(key)

    return c.body(null, 204)
  }
}

export function chainBucketRoutes<T extends Hono>(honoApp: T, app: App): T {
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
