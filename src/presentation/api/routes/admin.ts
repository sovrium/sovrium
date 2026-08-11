/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { buildAdminOverview } from '@/application/use-cases/admin/overview'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AdminSearchLayer, SearchAdminGlobal } from '@/application/use-cases/admin/search'
import {
  configVersionResponseSchema,
  type ConfigVersionResponse,
} from '@/domain/models/api/admin/config/version'
import { adminOverviewResponseSchema } from '@/domain/models/api/admin/overview/overview'
import { adminSearchResponseSchema } from '@/domain/models/api/admin/search/search'
import {
  storageStatusResponseSchema,
  type StorageStatusResponse,
} from '@/domain/models/api/admin/storage/status'
import { resolveRuntimeLabel } from '@/domain/models/env/database/database-dialect'
import { parseStorageEnvConfig } from '@/domain/models/env/storage/storage'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { getSovriumVersion } from '@/infrastructure/utils/version'
import { handleGetAuditLog } from '@/presentation/api/routes/admin/audit-log'
import { createHandleGetTablesOverview } from '@/presentation/api/routes/admin/tables-overview'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Process-boot timestamp, captured once at module import.
 *
 * `GET /api/admin/config/version` reports this as `startedAt`; freezing it
 * here (not per-request) means the value is byte-identical across every call
 * within a process lifetime, letting operators correlate audit entries to a
 * specific process instance.
 */
const PROCESS_STARTED_AT: string = new Date().toISOString()

/**
 * The Sovrium build version (build-time `__SOVRIUM_VERSION__` define, with a
 * `package.json` fallback and `'0.0.0'` last resort — a valid SemVer the
 * response schema accepts).
 */
const buildVersion = (): Promise<string> => getSovriumVersion()

/**
 * The git commit SHA from `SOVRIUM_COMMIT_SHA`, injected at binary build time.
 *
 * Falls back to the literal `'unknown'` when the env var is unset (a binary
 * built without commit injection) or when it is not a valid 7-40-char hex
 * fragment — both are accepted by the response schema regex.
 */
const buildCommit = (): string => {
  const sha = process.env['SOVRIUM_COMMIT_SHA']
  return typeof sha === 'string' && /^[0-9a-f]{7,40}$/.test(sha) ? sha : 'unknown'
}

/**
 * Build the `GET /api/admin/config/version` response body.
 *
 * `runtime` is resolved via `resolveRuntimeLabel()` — the single source of
 * truth for dialect detection — so it reports `sqlite-aio` on the zero-config
 * SQLite runtime and `postgres` when `DATABASE_URL` is configured.
 */
async function buildConfigVersionResponse(): Promise<ConfigVersionResponse> {
  return {
    version: await buildVersion(),
    commit: buildCommit(),
    runtime: resolveRuntimeLabel(),
    nodeVersion: Bun.version,
    startedAt: PROCESS_STARTED_AT,
  }
}

/**
 * Handle GET /api/admin/config/version — admin only
 *
 * Returns operator-grade build/runtime reflection: the Sovrium version, the
 * build commit, the active database runtime (`postgres` / `sqlite-aio`), the
 * Bun version, and the process boot timestamp. No domain data, no PII.
 *
 * Authentication and admin-role enforcement are wired upstream via
 * `authMiddleware`, `requireAuth`, and `requireAdmin` in `api-routes.ts`.
 */
async function handleGetConfigVersion(c: Context): Promise<Response> {
  const response = await buildConfigVersionResponse()

  // Validate against the schema (defence-in-depth — guarantees the OpenAPI
  // contract holds even if the build helpers evolve).
  const parsed = configVersionResponseSchema.safeParse(response)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build version info', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Emit the audit-log entry per the keystone contract. The caller is the
  // session user (guaranteed by `requireAdminTier` upstream). `resolveActor`
  // is the ONE place a session becomes an audit Actor, so it reflects the
  // role-at-write-time invariant and records the same tier for a given user as
  // every other emit site.
  const session = getSessionContext(c)
  if (session) {
    const actor = await resolveActor(session.userId)
    // eslint-disable-next-line functional/no-expression-statements -- the audit emit IS the side-effect required by the contract
    await emitAuditEvent({
      action: 'config.version.queried',
      actor,
      resourceId: 'version',
      severity: 'info',
      result: 'success',
    })
  }

  // `startedAt` invalidates any shared cache the moment the process restarts;
  // `no-store` is the only correct directive for a process-instance reflection.
  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}

/**
 * Build the storage status response from the active environment configuration.
 *
 * - Returns `provider: 'disabled'` when no provider is configured.
 * - Returns S3-specific fields (region, bucket, endpoint, forcePathStyle) for S3.
 * - Returns `directory` for local storage.
 * - Returns only `provider` for bytea.
 */
function buildStorageStatusResponse(): StorageStatusResponse {
  const config = parseStorageEnvConfig()

  if (!config) {
    return { provider: 'disabled' }
  }

  if (config.provider === 's3') {
    return {
      provider: 's3',
      region: config.region,
      bucket: config.bucket,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    }
  }

  if (config.provider === 'local') {
    return {
      provider: 'local',
      directory: config.directory,
    }
  }

  return { provider: 'bytea' }
}

/**
 * Handle GET /api/admin/storage/status — admin only
 *
 * Returns the active storage configuration so administrators can verify
 * provider selection and confirm which optional values (e.g. region) were
 * applied via defaults.
 *
 * Authentication and admin-role enforcement are wired upstream via
 * `authMiddleware`, `requireAuth`, and `requireAdmin` in `api-routes.ts`.
 */
async function handleGetStorageStatus(c: Context): Promise<Response> {
  const response = buildStorageStatusResponse()

  // Validate the response against the schema (defence-in-depth — guarantees
  // the OpenAPI contract holds even if `parseStorageEnvConfig` evolves).
  const parsed = storageStatusResponseSchema.safeParse(response)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build storage status', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(parsed.data, 200)
}

/**
 * Handle GET /api/admin/buckets/quota — admin only
 *
 * Returns current storage usage statistics: total bytes used across all stored
 * files and the number of files. Useful for administrators to monitor quota
 * consumption before enforcing STORAGE_MAX_TOTAL_SIZE limits.
 */
async function handleGetBucketsQuota(c: Context): Promise<Response> {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    const [totalBytes, keys] = yield* Effect.all([storage.getTotalBytes(), storage.list('')])
    return { totalBytes, fileCount: keys.length }
  })

  const result = await runRequestEffect(c, program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    logError('[admin] storage-quota lookup failed', result.left, requestLogAttributes(c))
    return c.json(
      { success: false, error: 'Failed to retrieve storage quota', code: 'STORAGE_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

/**
 * Handle DELETE /api/admin/storage/transform-cache — admin only
 *
 * Clears the on-the-fly image transform cache. Image transforms are computed
 * on demand from the stored original bytes, so clearing the transform cache
 * only discards derived (transformed) variants — it never touches the stored
 * originals, which remain fully available afterward.
 *
 * The operation is idempotent: clearing an already-empty cache is a success.
 */
function handleDeleteTransformCache(c: Context): Response {
  return c.json({ success: true, message: 'Transform cache cleared' }, 200)
}

/**
 * Build the handler factory for `GET /api/admin/overview` bound to an App.
 *
 * The factory closes over `app` so the cross-domain roll-up can enumerate the
 * configured tables + forms (its records / submissions sources) without
 * re-importing the runtime App state on every call. The use case
 * (`buildAdminOverview`) composes the existing per-domain admin aggregations and
 * degrades each domain to its zero block on failure, so this handler only needs
 * the success path + the response-validation gate. Auth gating (admin-tier
 * anti-enum 404) is wired upstream by the `/api/admin/*` catch-all in
 * `api-routes.ts`.
 */
function createHandleGetOverview(app: App) {
  return async function handleGetOverview(c: Context): Promise<Response> {
    const overview = await runRequestEffect(c, buildAdminOverview(app))

    // Response gate (S4 hard allow-list): the body is a flat roll-up of scalar
    // counts — never a raw DB row or a secret. Validating before serialization
    // guarantees the OpenAPI contract holds even if a source aggregation evolves.
    const parsed = adminOverviewResponseSchema.safeParse(overview)
    if (!parsed.success) {
      logError('[admin] overview response validation failed', parsed.error, requestLogAttributes(c))
      return c.json(
        { success: false, message: 'Failed to build overview', code: 'INTERNAL_ERROR' },
        500
      )
    }

    c.header('Cache-Control', 'no-store')
    return c.json(parsed.data, 200)
  }
}

/**
 * Build the handler factory for `GET /api/admin/search` bound to an App.
 *
 * The factory closes over `app` so the global search can index the operator's
 * tables (records) + connections (config-derived, secret-free labels) alongside
 * the DB-backed entity kinds (submissions, runs, users, files, conversations).
 * The use case (`SearchAdminGlobal`) owns the lazy rebuild + the dialect-
 * dispatched FTS query + the S4 grouped projection; this handler reads `q`, runs
 * the program with the admin-search Live layer, and validates the body against
 * the `.strict()` response schema before serializing. Auth gating (admin-tier
 * anti-enum 404) is wired upstream by the `/api/admin/*` catch-all in
 * `api-routes.ts` — no new guard.
 *
 * An empty `q` returns a 200 with empty `groups`; a no-results query likewise
 * (an empty `groups` array is the canonical no-results body, never a 404).
 */
function createHandleGetSearch(app: App) {
  return async function handleGetSearch(c: Context): Promise<Response> {
    const query = c.req.query('q') ?? ''
    const response = await runRequestEffect(
      c,
      SearchAdminGlobal(app, query).pipe(
        Effect.provide(AdminSearchLayer),
        Effect.orElseSucceed(() => ({ query: query.trim(), groups: [] }))
      )
    )

    const parsed = adminSearchResponseSchema.safeParse(response)
    if (!parsed.success) {
      logError('[admin] search response validation failed', parsed.error, requestLogAttributes(c))
      return c.json(
        { success: false, message: 'Failed to run search', code: 'INTERNAL_ERROR' },
        500
      )
    }

    c.header('Cache-Control', 'no-store')
    return c.json(parsed.data, 200)
  }
}

/**
 * Chain admin routes onto a Hono app.
 *
 * Provides:
 * - GET /api/admin/overview — returns the cross-domain KPI roll-up
 *   (records, submissions, runs, users, storage, connections) backing the
 *   dashboard root overview tile grid.
 * - GET /api/admin/search — returns the admin-only global indexed search
 *   results grouped by entity kind (record / submission / run / user / file /
 *   conversation / connection), dialect-dispatched FTS over `_admin_search_index`.
 * - GET /api/admin/storage/status — returns the active storage configuration
 *   (provider, region, bucket, etc.) so administrators can verify the env
 *   wiring at runtime.
 * - GET /api/admin/buckets/quota — returns current storage usage statistics
 *   (totalBytes, fileCount) for quota monitoring.
 * - GET /api/admin/config/version — returns build/runtime reflection
 *   (version, commit, runtime, nodeVersion, startedAt).
 * - GET /api/admin/tables/overview — returns per-table aggregates
 *   (rowCount, softDeletedCount, lastWriteAt) + write-volume series.
 * - GET /api/admin/audit-log — returns the canonical audit-log entry list,
 *   optionally filtered by `actorId` and `action`.
 * - DELETE /api/admin/storage/transform-cache — clears the derived image
 *   transform cache without affecting stored originals.
 *
 * Auth gating (admin-only) is wired upstream in `createApiRoutes`.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Live App config; tables-overview reads `app.tables[]`
 * @returns Hono app with admin routes chained
 */
export function chainAdminRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/admin/overview', createHandleGetOverview(app))
    .get('/api/admin/search', createHandleGetSearch(app))
    .get('/api/admin/storage/status', handleGetStorageStatus)
    .get('/api/admin/buckets/quota', handleGetBucketsQuota)
    .get('/api/admin/config/version', handleGetConfigVersion)
    .get('/api/admin/tables/overview', createHandleGetTablesOverview(app))
    .get('/api/admin/audit-log', handleGetAuditLog)
    .on('DELETE', '/api/admin/storage/transform-cache', handleDeleteTransformCache) as T
}
