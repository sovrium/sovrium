/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { BuildBucketFiles } from '@/application/use-cases/admin/bucket-files'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import {
  resolvePeriodWindow,
  type PeriodPreset,
} from '@/domain/models/api/admin/_shared/period-preset'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { bucketFilesQuerySchema } from '@/domain/models/api/admin/buckets/files'
import {
  bucketsListResponseSchema,
  type BucketAdminItem,
  type BucketProvider,
} from '@/domain/models/api/admin/buckets/list'
import {
  bucketsOverviewResponseSchema,
  type BucketsOverviewResponse,
  type BucketsOverviewSeriesPoint,
} from '@/domain/models/api/admin/buckets/overview'
import { bucketFileUploadResponseSchema } from '@/domain/models/api/admin/buckets/upload'
import { parseStorageEnvConfig } from '@/domain/models/env/storage/storage'
import { provideAdminBucketFilesLive } from '@/presentation/api/routes/admin/buckets/effect-runner'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import { buildUploadStorageKey } from '@/presentation/api/routes/buckets/upload-key'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

const DEFAULT_BUCKET_ID = '00000000-0000-4000-8000-000000000001'
const DEFAULT_BUCKET_NAME = 'default'


function resolveDefaultBucket(): {
  readonly provider: BucketProvider
  readonly region: string | null
} | null {
  const config = parseStorageEnvConfig()
  if (!config) return null
  if (config.provider === 's3') {
    return { provider: 's3', region: config.region }
  }
  if (config.provider === 'local') {
    return { provider: 'local', region: null }
  }
  if (config.provider === 'bytea') {
    return { provider: 'bytea', region: null }
  }
  return null
}

function buildBucketEnvelope(fileCount: number, totalBytes: number): BucketAdminItem['_admin'] {
  return {
    lastModifiedBy: null,
    deletedAt: null,
    metadata: { fileCount, totalBytes },
  }
}

async function buildBucketItems(): Promise<readonly BucketAdminItem[]> {
  const meta = resolveDefaultBucket()
  if (!meta) return []

  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    const [totalBytes, keys] = yield* Effect.all([storage.getTotalBytes(), storage.list('')])
    return { totalBytes, fileCount: keys.length }
  })

  const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
  const { totalBytes, fileCount } =
    result._tag === 'Right' ? result.right : { totalBytes: 0, fileCount: 0 }

  const now = new Date().toISOString()
  const item: BucketAdminItem = {
    id: DEFAULT_BUCKET_ID,
    name: DEFAULT_BUCKET_NAME,
    provider: meta.provider,
    region: meta.region,
    createdAt: now,
    updatedAt: now,
    _admin: buildBucketEnvelope(fileCount, totalBytes),
  }
  return [item]
}

function filterByProvider(
  items: readonly BucketAdminItem[],
  provider: BucketProvider | undefined
): readonly BucketAdminItem[] {
  if (!provider) return items
  return items.filter((i) => i.provider === provider)
}

function encodeCursor(afterId: string): string {
  return Buffer.from(JSON.stringify({ afterId }), 'utf8').toString('base64')
}

function decodeCursor(cursor: string, items: readonly BucketAdminItem[]): number {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly afterId?: unknown
    }
    if (typeof decoded.afterId !== 'string') return 0
    const idx = items.findIndex((i) => i.id === decoded.afterId)
    return idx === -1 ? 0 : idx + 1
  } catch {
    return 0
  }
}

function parseListQuery(c: Context): {
  readonly provider: BucketProvider | undefined
  readonly cursor: string | undefined
  readonly limit: number
} {
  const rawProvider = c.req.query('provider')
  const provider: BucketProvider | undefined =
    rawProvider === 's3' || rawProvider === 'local' || rawProvider === 'bytea'
      ? rawProvider
      : undefined
  const cursor = c.req.query('cursor')
  const limitRaw = Number(c.req.query('limit') ?? '50')
  const limit = Number.isFinite(limitRaw) && limitRaw >= 1 && limitRaw <= 200 ? limitRaw : 50
  return { provider, cursor, limit }
}

async function handleListBuckets(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const { provider, cursor, limit } = parseListQuery(c)

  const allItems = await buildBucketItems()
  const filtered = filterByProvider(allItems, provider)
  const startIndex = cursor ? decodeCursor(cursor, filtered) : 0
  const page = filtered.slice(startIndex, startIndex + limit)
  const nextStart = startIndex + page.length
  const nextCursor =
    nextStart < filtered.length && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null

  const body = { items: page, nextCursor }
  const parsed = bucketsListResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] bucket list response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build bucket list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_LIST_QUERIED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 200)
}

function buildSeriesPoints(
  fromIso: string,
  toIso: string,
  interval: '1h' | '1d'
): readonly BucketsOverviewSeriesPoint[] {
  const stepMs = interval === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toIso).getTime()
  const totalSpan = toMs - fromMs
  const expectedCount = Math.round(totalSpan / stepMs)
  return Array.from({ length: expectedCount }, (_, i): BucketsOverviewSeriesPoint => ({
    timestamp: new Date(fromMs + (i + 1) * stepMs).toISOString(),
    uploads: 0,
    bytes: 0,
  }))
}

async function handleBucketsOverview(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const rawPeriod = c.req.query('period')
  const preset: PeriodPreset =
    rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === '24h' ? rawPeriod : '24h'
  const window = resolvePeriodWindow(preset)

  const items = await buildBucketItems()
  const liveBuckets = items.filter((i) => i._admin.deletedAt === null)
  const totalBuckets = liveBuckets.length
  const totalFiles = liveBuckets.reduce(
    (sum, i) => sum + ((i._admin.metadata?.['fileCount'] as number | undefined) ?? 0),
    0
  )
  const totalBytes = liveBuckets.reduce(
    (sum, i) => sum + ((i._admin.metadata?.['totalBytes'] as number | undefined) ?? 0),
    0
  )

  const byProvider = {
    s3: liveBuckets.filter((i) => i.provider === 's3').length,
    local: liveBuckets.filter((i) => i.provider === 'local').length,
    bytea: liveBuckets.filter((i) => i.provider === 'bytea').length,
  }

  const points = buildSeriesPoints(window.from, window.to, window.interval)

  const body: BucketsOverviewResponse = {
    totals: { buckets: totalBuckets, files: totalFiles, totalBytes, by_provider: byProvider },
    series: { interval: window.interval, points: [...points] },
  }

  const parsed = bucketsOverviewResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] bucket overview response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build bucket overview', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_OVERVIEW_QUERIED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 200)
}

async function handleListBucketFiles(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedQuery = bucketFilesQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    sort: c.req.query('sort'),
    order: c.req.query('order'),
    type: c.req.query('type'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query parameters', code: 'BAD_REQUEST' }, 400)
  }
  const { cursor, limit, sort, order, type } = parsedQuery.data

  const program = BuildBucketFiles({
    sort,
    order,
    ...(type !== undefined ? { type } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    limit,
  })

  const result = await Effect.runPromise(program.pipe(provideAdminBucketFilesLive, Effect.either))
  if (result._tag === 'Left') {
    console.error('[admin] bucket file-list lookup failed', result.left)
    return c.json(
      { success: false, message: 'Failed to build bucket file list', code: 'INTERNAL_ERROR' },
      500
    )
  }
  if (result.right._tag === 'ValidationFailed') {
    console.error('[admin] bucket file-list response validation failed', result.right.error)
    return c.json(
      { success: false, message: 'Failed to build bucket file list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_FILES_QUERIED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(result.right.body, 200)
}

const ADMIN_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

function validateAdminUploadFilename(
  name: string
): { readonly status: 400; readonly error: string } | undefined {
  if (name.length === 0 || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return { status: 400, error: 'Invalid filename: path traversal sequences are not allowed' }
  }
  if (name.includes('\x00')) {
    return { status: 400, error: 'Invalid filename: null bytes are not allowed' }
  }
  return undefined
}

async function handleUploadBucketFile(c: Context): Promise<Response> {
  const body = await c.req.parseBody()
  const { file } = body
  if (!file || !(file instanceof File)) {
    return c.json({ success: false, message: 'No file provided', code: 'BAD_REQUEST' }, 400)
  }

  const filenameError = validateAdminUploadFilename(file.name)
  if (filenameError) {
    return c.json({ success: false, message: filenameError.error, code: 'BAD_REQUEST' }, 400)
  }

  if (file.size > ADMIN_UPLOAD_MAX_SIZE) {
    return c.json(
      {
        success: false,
        message: `File size ${file.size} bytes exceeds the ${ADMIN_UPLOAD_MAX_SIZE}-byte limit`,
        code: 'PAYLOAD_TOO_LARGE',
      },
      413
    )
  }

  return persistAdminUpload(c, file)
}

async function persistAdminUpload(c: Context, file: File): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const arrayBuffer = await file.arrayBuffer()
  const content = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'
  const key = buildUploadStorageKey(file.name)

  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.upload(key, content, mimeType)
    return yield* storage.getMetadata(key)
  })

  const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    console.error('[admin] bucket upload failed', result.left)
    return c.json(
      { success: false, message: `Upload failed: ${message}`, code: 'STORAGE_ERROR' },
      500
    )
  }

  const meta = result.right
  const parsed = bucketFileUploadResponseSchema.safeParse({
    success: true,
    file: {
      key: meta.key,
      filename: file.name,
      size: meta.size,
      mimeType: meta.contentType,
      createdAt: meta.lastModified,
    },
  })
  if (!parsed.success) {
    console.error('[admin] bucket upload response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build upload response', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_FILE_UPLOADED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 201)
}

export function chainAdminBucketsRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/admin/buckets/overview', handleBucketsOverview)
    .get('/api/admin/buckets/:bucketName/files', handleListBucketFiles)
    .post('/api/admin/buckets/:bucketName/files', handleUploadBucketFile)
    .get('/api/admin/buckets', handleListBuckets) as T
}
