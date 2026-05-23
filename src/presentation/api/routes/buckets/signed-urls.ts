/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { hasPermission } from '@/domain/models/shared/permissions'
import { inferMimeFromKey, isImageKey } from '@/domain/utils/mime-types'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { isNotFoundError } from '@/presentation/api/utils/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { Context } from 'hono'

const DEFAULT_EXPIRES_IN = 3600

const MIN_EXPIRES_IN = 60
const MAX_EXPIRES_IN = 604_800

const MAX_BATCH_SIZE = 100

const DEFAULT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

function signingSecret(): string {
  return process.env['AUTH_SECRET'] || 'sovrium-signed-url-dev-secret'
}

interface BatchFileRequest {
  readonly path: string
  readonly expiresIn?: number
  readonly operation?: 'download' | 'upload'
}

interface UploadConstraints {
  readonly contentType: string
  readonly maxSize: number
}

interface TokenSpec {
  readonly bucket: string
  readonly path: string
  readonly operation: 'download' | 'upload'
  readonly expires: number
  readonly constraints?: UploadConstraints
}

function computeToken(spec: TokenSpec): string {
  const { bucket, path, operation, expires, constraints } = spec
  const base = `${bucket}|${path}|${operation}|${expires}`
  const payload =
    operation === 'upload' && constraints
      ? `${base}|${constraints.contentType}|${constraints.maxSize}`
      : base
  return createHmac('sha256', signingSecret()).update(payload).digest('hex')
}

function tokensMatch(expected: string, candidate: string): boolean {
  if (expected.length !== candidate.length) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(candidate, 'hex'))
}

interface SignedUrlSpec {
  readonly c: Context
  readonly bucket: string
  readonly path: string
  readonly operation: 'download' | 'upload'
  readonly expiresInSeconds: number
  readonly constraints?: UploadConstraints
}

function buildSignedUrl(spec: SignedUrlSpec): {
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

function resolveExpiresIn(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return DEFAULT_EXPIRES_IN
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  if (raw < MIN_EXPIRES_IN || raw > MAX_EXPIRES_IN) return undefined
  return raw
}

function downloadFromStorage(path: string) {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.download(path)
  })
  return Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
}

async function fileExists(path: string): Promise<boolean> {
  const result = await downloadFromStorage(path)
  return result._tag === 'Right'
}

type BatchResult =
  | {
      readonly path: string
      readonly signedUrl: string
      readonly expiresAt: string
    }
  | { readonly path: string; readonly error: 'not_found' }

export function createHandleBatchSign(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    if (!resolveSignBucket(app, bucketName) || bucketName === undefined) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    if (!getSessionContext(c)) {
      return c.json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
    }

    const { files } = (await c.req.json().catch(() => ({}))) as { readonly files?: unknown }
    if (!Array.isArray(files)) {
      return c.json({ success: false, error: 'Missing files array', code: 'BAD_REQUEST' }, 400)
    }
    if (files.length > MAX_BATCH_SIZE) {
      return c.json(
        {
          success: false,
          error: `Batch size ${files.length} exceeds the ${MAX_BATCH_SIZE}-file limit`,
          code: 'BAD_REQUEST',
        },
        400
      )
    }

    const results = await signBatchEntries(c, bucketName, files as readonly BatchFileRequest[])
    if (results === undefined) {
      return c.json({ success: false, error: 'Invalid expiresIn value', code: 'BAD_REQUEST' }, 400)
    }
    return c.json({ results })
  }
}

async function signBatchEntries(
  c: Context,
  bucket: string,
  files: readonly BatchFileRequest[]
): Promise<readonly BatchResult[] | undefined> {
  const resolved = files.map((file) => ({
    file,
    expiresIn: resolveExpiresIn(file.expiresIn),
  }))
  if (resolved.some((entry) => entry.expiresIn === undefined)) return undefined

  return Promise.all(
    resolved.map(async ({ file, expiresIn }): Promise<BatchResult> => {
      const operation = file.operation === 'upload' ? 'upload' : 'download'
      if (operation === 'download' && !(await fileExists(file.path))) {
        return { path: file.path, error: 'not_found' }
      }
      const { signedUrl, expiresAt } = buildSignedUrl({
        c,
        bucket,
        path: file.path,
        operation,
        expiresInSeconds: expiresIn as number,
      })
      return { path: file.path, signedUrl, expiresAt }
    })
  )
}

export function createHandleSignedServe(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    if (!resolveSignBucket(app, bucketName) || bucketName === undefined) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    const query = c.req.query()
    const { path, token } = query
    const operation = query['op'] === 'upload' ? 'upload' : 'download'
    const expires = Number(query['expires'])

    if (!path || !token || !Number.isFinite(expires)) {
      return c.json({ success: false, error: 'Invalid signed URL', code: 'BAD_REQUEST' }, 400)
    }

    if (operation !== 'download') {
      return c.json({ success: false, error: 'Operation mismatch', code: 'FORBIDDEN' }, 403)
    }

    const expected = computeToken({ bucket: bucketName, path, operation: 'download', expires })
    if (!tokensMatch(expected, token)) {
      return c.json({ success: false, error: 'Invalid signature', code: 'FORBIDDEN' }, 403)
    }
    if (Date.now() > expires) {
      return c.json({ success: false, error: 'Signed URL expired', code: 'FORBIDDEN' }, 403)
    }

    return streamSignedDownload(c, path)
  }
}

function uploadToStorage(path: string, content: Uint8Array, mimeType: string) {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.upload(path, content, mimeType)
  })
  return Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
}

interface SignedUploadParams {
  readonly path: string
  readonly token: string
  readonly expires: number
  readonly contentType: string
  readonly maxSize: number
}

function verifySignedUpload(c: Context, bucketName: string): SignedUploadParams | Response {
  const query = c.req.query()
  const { path, token } = query
  const operation = query['op'] === 'upload' ? 'upload' : 'download'
  const expires = Number(query['expires'])
  const contentType = query['ct'] ?? ''
  const maxSize = Number(query['max'])

  if (!path || !token || !Number.isFinite(expires)) {
    return c.json({ success: false, error: 'Invalid signed URL', code: 'BAD_REQUEST' }, 400)
  }
  if (operation !== 'upload' || !Number.isFinite(maxSize)) {
    return c.json({ success: false, error: 'Operation mismatch', code: 'FORBIDDEN' }, 403)
  }

  const expected = computeToken({
    bucket: bucketName,
    path,
    operation: 'upload',
    expires,
    constraints: { contentType, maxSize },
  })
  if (!tokensMatch(expected, token)) {
    return c.json({ success: false, error: 'Invalid signature', code: 'FORBIDDEN' }, 403)
  }
  if (Date.now() > expires) {
    return c.json({ success: false, error: 'Signed URL expired', code: 'FORBIDDEN' }, 403)
  }

  return { path, token, expires, contentType, maxSize }
}

async function storeSignedUpload(c: Context, params: SignedUploadParams): Promise<Response> {
  const { path, contentType, maxSize } = params
  const requestType = c.req.header('content-type')?.split(';')[0]?.trim() ?? ''

  if (contentType !== '' && requestType !== contentType) {
    return c.json({ success: false, error: 'Content type not allowed', code: 'BAD_REQUEST' }, 400)
  }

  const body = new Uint8Array(await c.req.arrayBuffer())
  if (body.byteLength > maxSize) {
    return c.json(
      {
        success: false,
        error: 'Upload exceeds the maximum allowed size',
        code: 'PAYLOAD_TOO_LARGE',
      },
      413
    )
  }

  const mimeType = requestType !== '' ? requestType : inferMimeFromKey(path)
  const result = await uploadToStorage(path, body, mimeType)
  if (result._tag === 'Left') {
    return c.json({ success: false, error: 'Upload failed', code: 'STORAGE_ERROR' }, 500)
  }
  return c.json({ success: true, path })
}

export function createHandleSignedUpload(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    if (!resolveSignBucket(app, bucketName) || bucketName === undefined) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    const verified = verifySignedUpload(c, bucketName)
    if (verified instanceof Response) return verified

    return storeSignedUpload(c, verified)
  }
}

function stripUuidPrefix(key: string): string {
  const match = key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)
  return match?.[1] ?? key
}

function buildSignedContentDisposition(path: string): string {
  const disposition = isImageKey(path) ? 'inline' : 'attachment'
  const segments = stripUuidPrefix(path).split('/')
  const filename = segments.at(-1) ?? path
  if (/^[\x20-\x7E]*$/.test(filename)) {
    return `${disposition}; filename="${filename}"`
  }
  return `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`
}

async function streamSignedDownload(c: Context, path: string): Promise<Response> {
  const result = await downloadFromStorage(path)
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const isNotFound = isNotFoundError(cause)
    return c.json(
      {
        success: false,
        error: isNotFound ? 'File not found' : 'Download failed',
        code: isNotFound ? 'NOT_FOUND' : 'STORAGE_ERROR',
      },
      isNotFound ? 404 : 500
    )
  }
  const body = Uint8Array.from(result.right)
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': inferMimeFromKey(path),
      'Content-Disposition': buildSignedContentDisposition(path),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function resolveSignBucket(app: App, bucketName: string | undefined): Bucket | undefined {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  return bucketName === 'default' ? { name: 'default', public: false } : undefined
}

function canSign(
  bucket: Bucket,
  operation: 'download' | 'upload',
  userRole: string | undefined
): boolean {
  const permission =
    operation === 'upload' ? bucket.permissions?.signUpload : bucket.permissions?.sign
  if (permission === undefined) return userRole === 'admin'
  if (permission === 'all') return true
  if (userRole === undefined) return false
  if (userRole === 'admin') return true
  return hasPermission(permission, userRole)
}

interface SignRequestBody {
  readonly path?: unknown
  readonly operation?: unknown
  readonly expiresIn?: unknown
  readonly contentType?: unknown
  readonly maxSize?: unknown
}

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

function constraintsForSign(
  operation: 'download' | 'upload',
  body: SignRequestBody
): UploadConstraints | undefined | 'invalid' {
  if (operation !== 'upload') return undefined
  return resolveUploadConstraints(body) ?? 'invalid'
}

async function buildSignResponse(
  c: Context,
  bucketName: string,
  operation: 'download' | 'upload',
  body: SignRequestBody
): Promise<Response> {
  const { path } = body
  if (typeof path !== 'string' || path.length === 0) {
    return c.json({ success: false, error: 'Missing path', code: 'BAD_REQUEST' }, 400)
  }

  const expiresInSeconds = resolveExpiresIn(body.expiresIn)
  if (expiresInSeconds === undefined) {
    return c.json({ success: false, error: 'Invalid expiresIn value', code: 'BAD_REQUEST' }, 400)
  }

  const constraints = constraintsForSign(operation, body)
  if (constraints === 'invalid') {
    return c.json({ success: false, error: 'Invalid maxSize value', code: 'BAD_REQUEST' }, 400)
  }

  if (operation === 'download' && !(await fileExists(path))) {
    return c.json({ success: false, error: 'File not found', code: 'NOT_FOUND' }, 404)
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

export function createHandleSign(app: App) {
  return async (c: Context) => {
    const bucketName = c.req.param('bucketName')
    const bucket = resolveSignBucket(app, bucketName)
    if (!bucket || bucketName === undefined) {
      return c.json({ success: false, error: 'Bucket not found', code: 'NOT_FOUND' }, 404)
    }

    const body = (await c.req.json().catch(() => ({}))) as SignRequestBody
    const operation = body.operation === 'upload' ? 'upload' : 'download'

    const session = getSessionContext(c)
    if (!session) {
      return c.json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
    }

    const userRole = await getUserRole(session.userId)

    if (!canSign(bucket, operation, userRole)) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    return buildSignResponse(c, bucketName, operation, body)
  }
}
