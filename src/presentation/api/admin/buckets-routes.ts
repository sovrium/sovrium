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
import {
  buildBucketUploadSeries,
  BuildBucketUploadSeries,
} from '@/application/use-cases/admin/buckets-overview'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { parseSortSpec } from '@/domain/kernel/format/sort-spec'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  bucketFilesQuerySchema,
  normalizeBucketFilesSortKey,
} from '@/domain/models/api/admin/buckets/files'
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
import {
  resolvePeriodWindow,
  type PeriodPreset,
  type PeriodWindow,
} from '@/domain/models/api/admin/envelope/period-preset'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import {
  bucketIdForName,
  declaredBucketNames,
  DEFAULT_BUCKET_ID,
} from '@/domain/models/app/buckets/bucket-identity'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { buildUploadStorageKey } from '@/infrastructure/storage/upload-key'
import { notFound, payloadTooLarge } from '@/presentation/api/runtime/auth-helpers'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

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
 * Live reading of the storage backend: how many files it holds and how many
 * bytes they occupy. GLOBAL figures — Sovrium stores every upload under a flat
 * `<uuid>-<filename>` key with no bucket component
 * ({@link buildUploadStorageKey}), so there is no per-bucket attribution to
 * compute. A backend that cannot be read reports zeros rather than failing the
 * request: an operator triaging a storage problem needs the dashboard to render.
 */
async function readStorageTotals(c: Context): Promise<{
  readonly fileCount: number
  readonly totalBytes: number
}> {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    const [totalBytes, keys] = yield* Effect.all([storage.getTotalBytes, storage.list('')])
    return { totalBytes, fileCount: keys.length }
  })

  const result = await Effect.runPromise(provideDomain(c, program).pipe(Effect.result))
  return result._tag === 'Success' ? result.success : { totalBytes: 0, fileCount: 0 }
}

/**
 * Build one list item per bucket the app declares — or one for the virtual
 * `default` bucket when it declares none. Empty when no storage provider
 * resolves: a declaration that cannot hold a byte is not a bucket.
 *
 * Every item carries the same `metadata`, because it is the same shared store:
 * declared buckets are path prefixes inside the one env-resolved backend, and
 * the sibling file browser (`/api/admin/buckets/:bucketName/files`) already
 * reports that backend-wide `totalBytes` for any bucket name. These per-item
 * figures are therefore never summed — the overview reads
 * {@link readStorageTotals} once — or one 1 KB upload would be reported as three.
 */
async function buildBucketItems(c: Context, app: App): Promise<readonly BucketAdminItem[]> {
  const meta = resolveDefaultBucket()
  if (!meta) return []

  const { totalBytes, fileCount } = await readStorageTotals(c)
  const now = new Date().toISOString()

  return declaredBucketNames(app.buckets).map((name) => ({
    id: bucketIdForName(name),
    name,
    provider: meta.provider,
    region: meta.region,
    createdAt: now,
    updatedAt: now,
    _admin: buildBucketEnvelope(fileCount, totalBytes),
  }))
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
async function handleListBuckets(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const { provider, cursor, limit } = parseListQuery(c)

  const allItems = await buildBucketItems(c, app)
  const filtered = filterByProvider(allItems, provider)
  const startIndex = cursor ? decodeCursor(cursor, filtered) : 0
  const page = filtered.slice(startIndex, startIndex + limit)
  const nextStart = startIndex + page.length
  const nextCursor =
    nextStart < filtered.length && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null

  const body = { items: page, nextCursor }
  const parsed = decodeSafe(bucketsListResponseSchema)(body)
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
  const actor = await runDomainPromise(c, resolveActor(session.userId))
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
 * Read the window's upload series from the storage catalog. A failed read
 * degrades to an all-zero series of the correct length rather than failing the
 * request — the chart axis still renders while the operator triages.
 */
async function readOverviewSeries(
  c: Context,
  window: PeriodWindow
): Promise<readonly BucketsOverviewSeriesPoint[]> {
  const result = await runRequestEffect(
    c,
    provideDomain(c, BuildBucketUploadSeries(window)).pipe(Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[admin] bucket overview series read failed', result.failure, requestLogAttributes(c))
    return buildBucketUploadSeries(window, [])
  }
  return result.success
}

/**
 * Build the overview's right-edge `totals` snapshot.
 *
 * `buckets` counts what the app DECLARES; `files` / `totalBytes` are the
 * backend's global figures, read ONCE. Summing the per-bucket metadata instead
 * would multiply a single upload by the bucket count (see
 * {@link buildBucketItems}). With no provider resolved there is nothing to
 * count: a declaration that cannot hold a byte is not a bucket.
 *
 * No bucket can be soft-deleted today, so every declared bucket is live.
 */
async function buildOverviewTotals(
  c: Context,
  app: App
): Promise<BucketsOverviewResponse['totals']> {
  const meta = resolveDefaultBucket()
  if (!meta) {
    return { buckets: 0, files: 0, totalBytes: 0, by_provider: { s3: 0, local: 0, bytea: 0 } }
  }

  const buckets = declaredBucketNames(app.buckets).length
  const { fileCount, totalBytes } = await readStorageTotals(c)

  // Declared buckets are path prefixes inside the ONE env-resolved backend, so
  // they all land under the same provider key — which is what keeps the
  // partition invariant (`by_provider` sums to `buckets`) true.
  return {
    buckets,
    files: fileCount,
    totalBytes,
    by_provider: {
      s3: meta.provider === 's3' ? buckets : 0,
      local: meta.provider === 'local' ? buckets : 0,
      bytea: meta.provider === 'bytea' ? buckets : 0,
    },
  }
}

/**
 * GET /api/admin/buckets/overview handler.
 */
async function handleBucketsOverview(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  // Parse period preset (default 24h).
  const rawPeriod = c.req.query('period')
  const preset: PeriodPreset =
    rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === '24h' ? rawPeriod : '24h'
  const window = resolvePeriodWindow(preset)

  const totals = await buildOverviewTotals(c, app)
  const points = await readOverviewSeries(c, window)

  const body: BucketsOverviewResponse = {
    totals,
    series: { interval: window.interval, points: [...points] },
  }

  const parsed = decodeSafe(bucketsOverviewResponseSchema)(body)
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
  const actor = await runDomainPromise(c, resolveActor(session.userId))
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
 * totalBytes, appliedQuery }`) — replacing the legacy N+1
 * `StorageService.list('') + getMetadata(key)` walk. The `?sort` / `?order` /
 * `?type` / `?q` / `?cursor` / `?limit` knobs are parsed by
 * {@link bucketFilesQuerySchema}; all projection / cursor / pagination logic
 * lives in the `bucket-files` use case.
 *
 * `?q=` searches `filename` + storage `key` server-side, over the WHOLE bucket.
 * It used to be accepted and discarded — Hono drops an unlisted query param
 * silently — so the grid narrowed the single page it held and reported a file
 * three pages down as absent. The operator was told a file they had uploaded
 * did not exist.
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
/**
 * Parse the file-browser query knobs. Defaults come from the schema
 * (sort=date, order=desc, limit=50); an over-length `q` is a parse FAILURE
 * rather than a truncation, so the caller answers 400 instead of quietly
 * searching for something the operator never typed.
 *
 * The literal below is an explicit ALLOW-LIST, and that is exactly how `?q=`
 * used to vanish: an unlisted key is dropped by Hono without complaint, so the
 * request looked well-formed and the response was a confident 200 carrying the
 * unfiltered first page.
 *
 * `?sort=` takes BOTH spellings. The pair — `?sort=size&order=desc` — is this
 * endpoint's own; the combined `?sort=size:desc` is what the file browser's
 * column headers actually emit, and answering it with a 400 put an error where
 * the operator asked for an ordering. {@link parseSortSpec} splits the combined
 * form and nothing more, so a key outside the enum still fails validation:
 * widening what can be SPELLED must not widen what can be SERVED, or the grid
 * paints a sort arrow over whatever order the store happened to yield.
 *
 * The field then passes through {@link normalizeBucketFilesSortKey}, which
 * rewrites the one legacy spelling (`date` → `createdAt`) so the alias and the
 * canonical name are the SAME sort downstream rather than two wirings that have
 * to be kept in agreement. Unknown keys are untouched by it and still 400.
 */
function parseBucketFilesQuery(c: Context) {
  const sortSpec = parseSortSpec(c.req.query('sort'))
  return decodeSafe(bucketFilesQuerySchema)({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    sort: normalizeBucketFilesSortKey(sortSpec?.field),
    // A direction spelled INSIDE `sort` wins over a separate `?order=`: it is
    // the more specific statement, and it is the only one a header click sends.
    order: sortSpec?.direction ?? c.req.query('order'),
    type: c.req.query('type'),
    q: c.req.query('q'),
  })
}

async function handleListBucketFiles(c: Context): Promise<Response> {
  const { session } = (c as ContextWithSession).var
  if (!session) return notFound(c, 'Not found')

  const parsedQuery = parseBucketFilesQuery(c)
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query parameters', code: 'BAD_REQUEST' }, 400)
  }
  const { cursor, limit, sort, order, type, q } = parsedQuery.data

  const program = BuildBucketFiles({
    sort,
    order,
    ...(type !== undefined ? { type } : {}),
    ...(q !== undefined ? { q } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    limit,
  })

  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    logError('[admin] bucket file-list lookup failed', result.failure, requestLogAttributes(c))
    return c.json(
      { success: false, message: 'Failed to build bucket file list', code: 'INTERNAL_ERROR' },
      500
    )
  }
  if (result.success._tag === 'ValidationFailed') {
    logError(
      '[admin] bucket file-list response validation failed',
      result.success.error,
      requestLogAttributes(c)
    )
    return c.json(
      { success: false, message: 'Failed to build bucket file list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit one audit entry per call (canonical resource.type 'bucket' — derived by
  // the emit use-case from the ACTION_CATALOG entry for BUCKET_FILES_QUERIED).
  const actor = await runDomainPromise(c, resolveActor(session.userId))
  await emitAuditEvent({
    action: AUDIT_ACTIONS.BUCKET_FILES_QUERIED,
    actor,
    resourceId: DEFAULT_BUCKET_ID,
    severity: 'info',
    result: 'success',
  })

  return c.json(result.success.body, 200)
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

  return persistAdminUpload(c, file, c.req.param('bucketName') ?? 'default')
}

/**
 * Persist a validated admin-console upload via the configured `StorageService`,
 * read back the catalog metadata, validate the response against
 * `bucketFileUploadResponseSchema`, emit the `bucket.file.uploaded` audit entry,
 * and return the 201 response. Extracted from {@link handleUploadBucketFile} to
 * keep that handler under the per-function statement/line thresholds — mirrors
 * the public route's `persistUpload` extraction.
 */
async function persistAdminUpload(c: Context, file: File, bucket: string): Promise<Response> {
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
    yield* storage.upload(key, content, mimeType, bucket)
    return yield* storage.getMetadata(key, bucket)
  })

  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    const { cause } = result.failure as { readonly cause?: unknown }
    const message = cause instanceof Error ? cause.message : String(cause)
    logError('[admin] bucket upload failed', result.failure, requestLogAttributes(c))
    return c.json(
      { success: false, message: `Upload failed: ${message}`, code: 'STORAGE_ERROR' },
      500
    )
  }

  const meta = result.success
  const parsed = decodeSafe(bucketFileUploadResponseSchema)({
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
  const actor = await runDomainPromise(c, resolveActor(session.userId))
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
 * `app` is threaded in because a bucket is a DECLARATION (`app.buckets[]`), not
 * a storage backend: without it the list and the overview could only ever report
 * the one env-resolved backend, contradicting the public upload route and the
 * admin Files sidebar, which both address every declared bucket by name.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAuth + requireAdminTier on the matching paths). The order matters
 * — the overview + file-list routes are registered first so the more-specific
 * paths take precedence over the bare-list path (Hono routes by registration
 * order for `.get` overlaps). The POST upload is registered before the bare
 * list for the same precedence reason.
 */
export function chainAdminBucketsRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/admin/buckets/overview', (c) => handleBucketsOverview(c, app))
    .get('/api/admin/buckets/:bucketName/files', handleListBucketFiles)
    .post('/api/admin/buckets/:bucketName/files', handleUploadBucketFile)
    .get('/api/admin/buckets', (c) => handleListBuckets(c, app)) as T
}
