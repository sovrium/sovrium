/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin endpoints for the bucket domain.
 *
 * - GET /api/admin/buckets           — cursor-paginated list
 * - GET /api/admin/buckets/overview  — totals + time-bucketed series
 *
 * Both emit a `bucket.{list|overview}.queried` audit-log entry on success,
 * with the canonical `resource.type === 'bucket'` (NOT `bucket.list` /
 * `bucket.overview`) — see audit-log action-catalog for the contract.
 *
 * Both endpoints are gated upstream by `requireAdminTier()` (admin +
 * operator); unauthenticated and non-admin-tier callers receive 404 per
 * anti-enumeration (S1).
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
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAdminBucketFilesLive } from '@/presentation/api/routes/admin/buckets/effect-runner'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import { buildUploadStorageKey } from '@/presentation/api/routes/buckets/upload-key'
import { notFound, payloadTooLarge } from '@/presentation/api/utils/auth-helpers'
import { requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

/**
 * Deterministic UUID v4 for the default bucket id.
 *
 * Sovrium today has a single virtual "default" bucket per provider. Picking
 * a stable identifier (rather than generating one per call) means the admin
 * dashboard's bucket-detail pages remain bookmarkable across process
 * restarts. Real multi-bucket support (Phase 1) will introduce per-bucket
 * persisted UUIDs.
 */
const DEFAULT_BUCKET_ID = '00000000-0000-4000-8000-000000000001'
const DEFAULT_BUCKET_NAME = 'default'

/* eslint-disable unicorn/no-null -- the bucket admin schema canonically uses `null` for absent values (matches the public schema's nullable fields and the audit envelope contract; switching to `undefined` would diverge from the API shape) */

/**
 * Pure helper — resolve env-driven bucket metadata. Returns null when no
 * provider is configured (storage disabled).
 */
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

/**
 * Build the canonical `_admin` envelope for a bucket. The metadata block is
 * always populated for the bucket domain (per user-story design D3 + C3).
 */
function buildBucketEnvelope(fileCount: number, totalBytes: number): BucketAdminItem['_admin'] {
  return {
    lastModifiedBy: null,
    deletedAt: null,
    metadata: { fileCount, totalBytes },
  }
}

/**
 * Build the canonical list of bucket items (always 0 or 1 today).
 */
async function buildBucketItems(): Promise<readonly BucketAdminItem[]> {
  const meta = resolveDefaultBucket()
  if (!meta) return []

  // Read totals from the active StorageService. The single default bucket
  // owns every stored file, so global totals === per-bucket totals.
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

/**
 * Apply the `?provider` filter (the only post-fetch narrowing we need today).
 */
function filterByProvider(
  items: readonly BucketAdminItem[],
  provider: BucketProvider | undefined
): readonly BucketAdminItem[] {
  if (!provider) return items
  return items.filter((i) => i.provider === provider)
}

/**
 * Cursor encoding — opaque base64 of `{ afterId }`. Stable across calls.
 */
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

/**
 * Parse the list-endpoint query string into the typed knobs.
 */
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

/**
 * GET /api/admin/buckets handler.
 */
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
    logError(
      '[admin] bucket list response validation failed',
      parsed.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build bucket list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry (canonical resource.type 'bucket' — derived by emit
  // use-case from the ACTION_CATALOG entry for BUCKET_LIST_QUERIED).
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_LIST_QUERIED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 200)
}

/**
 * Build a synthetic series of zero-filled points covering the period
 * window, aligned to the interval grid.
 */
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

/**
 * GET /api/admin/buckets/overview handler.
 */
async function handleBucketsOverview(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  // Parse period preset (default 24h).
  const rawPeriod = c.req.query('period')
  const preset: PeriodPreset =
    rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === '24h' ? rawPeriod : '24h'
  const window = resolvePeriodWindow(preset)

  // Resolve totals from the default bucket projection.
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
    logError(
      '[admin] bucket overview response validation failed',
      parsed.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build bucket overview', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit audit entry (canonical resource.type 'bucket' — derived by emit
  // use-case from the ACTION_CATALOG entry for BUCKET_OVERVIEW_QUERIED).
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_OVERVIEW_QUERIED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 200)
}

/**
 * GET /api/admin/buckets/:bucketName/files handler — the file browser's file
 * list.
 *
 * The UPGRADED contract: a cursor-paginated, sortable,
 * mimeType-filterable enumeration of `system.file_storage_metadata` rows
 * (`{ items: [{ key, filename, size, mimeType, createdAt }], nextCursor,
 * totalBytes }`) — replacing the legacy N+1 `StorageService.list('') +
 * getMetadata(key)` walk. The `?sort` / `?order` / `?type` / `?cursor` / `?limit`
 * knobs are parsed by {@link bucketFilesQuerySchema}; all projection / cursor /
 * pagination logic lives in the `bucket-files` use case.
 *
 * Sovrium today backs every named bucket with a single virtual "default"
 * bucket, so the listing reads ALL metadata rows (the per-named-bucket
 * projection is a Phase-1 concern) — replicating the legacy "all keys"
 * semantics. `totalBytes` is the bucket-wide `SUM(size)`, invariant across the
 * `type` filter and pagination, so the quota bar renders without a second
 * round-trip.
 *
 * The endpoint is gated upstream by `requireAdminTier()` (admin + operator);
 * unauthenticated and non-admin-tier callers receive 404 per anti-enumeration
 * (S1). One `bucket.files.queried` audit entry is emitted per call on success
 * (canonical `resource.type === 'bucket'`).
 *
 * The session guard below is belt-and-braces: the upstream gate already 404s a
 * session-less caller, so it is unreachable in a correctly-gated app. It exists
 * because the gate was once genuinely missing — the no-auth branch of
 * `createApiRoutes` had no `/api/admin/*` catch-all — and the audit-emit at the
 * bottom then dereferenced `undefined` and answered 500, which is both the
 * wrong status and a confirmation that the route exists.
 */
async function handleListBucketFiles(c: Context): Promise<Response> {
  const { session } = (c as ContextWithSession).var
  if (!session) return notFound(c, 'Not found')

  // Parse the file-browser query knobs (cursor/limit/sort/order/type). Defaults
  // are applied by the schema (sort=date, order=desc, limit=50).
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

  const result = await runRequestEffect(c, program.pipe(provideAdminBucketFilesLive, Effect.either))
  if (result._tag === 'Left') {
    logError('[admin] bucket file-list lookup failed', result.left, requestLogAttributes(c))
    return c.json(
      { success: false, message: 'Failed to build bucket file list', code: 'INTERNAL_ERROR' },
      500
    )
  }
  if (result.right._tag === 'ValidationFailed') {
    logError(
      '[admin] bucket file-list response validation failed',
      result.right.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build bucket file list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit one audit entry per call (canonical resource.type 'bucket' — derived by
  // the emit use-case from the ACTION_CATALOG entry for BUCKET_FILES_QUERIED).
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_FILES_QUERIED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(result.right.body, 200)
}

/**
 * Default admin-console upload size cap (10 MB). Mirrors the signed-URL upload
 * default (`DEFAULT_UPLOAD_MAX_SIZE` in `buckets/signed-urls.ts`) so the console
 * upload, the signed-URL flow, and the public route share one frugal default.
 * The admin console writes to the single virtual `default` bucket, so there is
 * no per-bucket `maxFileSize` to consult here.
 */
const ADMIN_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

/**
 * Reject unsafe filenames before any storage write — path-traversal sequences
 * and null bytes (mirrors `validateUploadFilename` in the public upload route).
 * Returns an HTTP-4xx error descriptor when unsafe, `undefined` when safe.
 */
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

/**
 * POST /api/admin/buckets/:bucketName/files handler — the admin console's file
 * upload. The write counterpart to {@link handleListBucketFiles}; it wires the
 * file browser's "Ajouter un fichier" modal to a real backend.
 *
 * Consumes a `multipart/form-data` body with a single `file` part (the SAME
 * wire format the public upload route accepts). The file is stored under the
 * shared `<uuid>-<filename>` key convention ({@link buildUploadStorageKey}),
 * then the just-written `system.file_storage_metadata` row is read back so the
 * response carries the canonical, list-consistent `bucketFileItemSchema` shape
 * (`{ key, filename, size, mimeType, createdAt }`) under a `{ success, file }`
 * envelope (S4 — never a raw storage row).
 *
 * Oversized payloads are rejected with HTTP 413 before the storage write
 * (10 MB default, mirroring the signed-URL flow). The endpoint is gated
 * upstream by `requireAdminTier()` (admin + operator); unauthenticated and
 * non-admin-tier callers receive 404 per anti-enumeration (S1) — the gate is
 * the method-agnostic `.use('/api/admin/buckets/*', …)` middleware, so the POST
 * is admin-guarded automatically. One `bucket.file.uploaded` audit entry is
 * emitted on success (canonical `resource.type === 'bucket'`).
 */
async function handleUploadBucketFile(c: Context): Promise<Response> {
  // Parse the multipart body and assert the `file` part is a binary File.
  const body = await c.req.parseBody()
  const { file } = body
  if (!file || !(file instanceof File)) {
    return c.json({ success: false, message: 'No file provided', code: 'BAD_REQUEST' }, 400)
  }

  const filenameError = validateAdminUploadFilename(file.name)
  if (filenameError) {
    return c.json({ success: false, message: filenameError.error, code: 'BAD_REQUEST' }, 400)
  }

  // Frugal default size guard (10 MB), enforced before the storage write so an
  // oversized payload is rejected early regardless of provider.
  if (file.size > ADMIN_UPLOAD_MAX_SIZE) {
    return payloadTooLarge(
      c,
      `File size ${file.size} bytes exceeds the ${ADMIN_UPLOAD_MAX_SIZE}-byte limit`
    )
  }

  return persistAdminUpload(c, file)
}

/**
 * Persist a validated admin-console upload via the configured `StorageService`,
 * read back the catalog metadata, validate the response against
 * `bucketFileUploadResponseSchema`, emit the `bucket.file.uploaded` audit entry,
 * and return the 201 response. Extracted from {@link handleUploadBucketFile} to
 * keep that handler under the per-function statement/line thresholds — mirrors
 * the public route's `persistUpload` extraction.
 */
async function persistAdminUpload(c: Context, file: File): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const arrayBuffer = await file.arrayBuffer()
  const content = new Uint8Array(arrayBuffer)
  const mimeType = file.type || 'application/octet-stream'
  const key = buildUploadStorageKey(file.name)

  // Upload, then read back the catalog metadata so the response carries the
  // canonical size/createdAt from `system.file_storage_metadata` (the same
  // source the list endpoint reads) rather than echoing request-side values.
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.upload(key, content, mimeType)
    return yield* storage.getMetadata(key)
  })

  const result = await runRequestEffect(c, program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    const { cause } = result.left as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    logError('[admin] bucket upload failed', result.left, requestLogAttributes(c))
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
    logError('[admin] bucket upload response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build upload response', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit one audit entry (canonical resource.type 'bucket' — derived by the
  // emit use-case from the ACTION_CATALOG entry for BUCKET_FILE_UPLOADED).
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_FILE_UPLOADED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 201)
}

/**
 * Chain the admin/buckets routes onto a Hono app.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAuth + requireAdminTier on the matching paths). The order matters
 * — the overview + file-list routes are registered first so the more-specific
 * paths take precedence over the bare-list path (Hono routes by registration
 * order for `.get` overlaps). The POST upload is registered before the bare
 * list for the same precedence reason.
 */
export function chainAdminBucketsRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/admin/buckets/overview', handleBucketsOverview)
    .get('/api/admin/buckets/:bucketName/files', handleListBucketFiles)
    .post('/api/admin/buckets/:bucketName/files', handleUploadBucketFile)
    .get('/api/admin/buckets', handleListBuckets) as T
}
