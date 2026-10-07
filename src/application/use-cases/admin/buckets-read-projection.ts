/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the bucket list and the storage overview are built from: the buckets the
 * app exposes (the built-in `system` plus every declared one), each counting
 * only the objects recorded under it, and the backend's global totals. A store
 * that cannot be read degrades to empty — logged, never silently — so an
 * operator triaging a storage problem still gets a console that renders.
 */

import { Cause, DateTime, Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { ReadBucketUsage } from '@/application/use-cases/admin/bucket-files'
import { bucketIdForName, declaredBucketNames } from '@/domain/models/app/buckets/bucket-identity'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { Logger } from '@/infrastructure/logging/logger'
import type { AdminReadServices } from '@/application/use-cases/admin/admin-read-operation'
import type { BucketAdminItem, BucketProvider } from '@/domain/models/api/admin/buckets/list'
import type { BucketsOverviewResponse } from '@/domain/models/api/admin/buckets/overview'
import type { App } from '@/domain/models/app'

/** The env-resolved backend's provider and region, or `null` with storage off. */
const resolveDefaultBucket = (): {
  readonly provider: BucketProvider
  readonly region: string | null
} | null => {
  const config = parseStorageEnvConfig()
  if (!config) return null
  if (config.provider === 's3') return { provider: 's3', region: config.region }
  if (config.provider === 'local') return { provider: 'local', region: null }
  if (config.provider === 'bytea') return { provider: 'bytea', region: null }
  return null
}

/**
 * Log why a storage read degraded, then fall back. An operator triaging a
 * storage problem needs the console to render, so a store that cannot be read
 * reports empty rather than failing the request — but never silently (E6).
 */
export const degradeTo = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  what: string,
  empty: A
): Effect.Effect<A, never, R | Logger> =>
  effect.pipe(
    Effect.tapCause((cause: Cause.Cause<E>) =>
      Effect.gen(function* () {
        const logger = yield* Logger
        yield* logger.error(`[admin] ${what} read failed`, Cause.squash(cause))
      })
    ),
    Effect.orElseSucceed(() => empty),
    Effect.withSpan('admin.buckets.degrade', { attributes: { 'admin.buckets.read': what } })
  )

type Usage = { readonly fileCount: number; readonly totalBytes: number }

const EMPTY_USAGE: ReadonlyMap<string, Usage> = new Map()

// ─── List ────────────────────────────────────────────────────────────────────

/** Cursor encoding — opaque base64 of `{ afterId }`. Stable across calls. */
export const encodeCursor = (afterId: string): string =>
  Buffer.from(JSON.stringify({ afterId }), 'utf8').toString('base64')

/** A malformed or stale cursor rewinds to the first page rather than erroring. */
export const decodeCursor = (cursor: string, items: readonly BucketAdminItem[]): number => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly afterId?: unknown
    }
    if (typeof decoded.afterId !== 'string') return 0
    const index = items.findIndex((item) => item.id === decoded.afterId)
    return index === -1 ? 0 : index + 1
  } catch {
    return 0
  }
}

export interface BucketsListInput {
  readonly provider: BucketProvider | undefined
  readonly cursor: string | undefined
  readonly limit: number
}

/**
 * The list knobs, read leniently as the route always read them: an unknown
 * provider is no filter, and a limit outside 1..200 is the default 50.
 */
export const decodeBucketsListQuery = (
  raw: Readonly<Record<string, unknown>>
): BucketsListInput => {
  const rawProvider = raw['provider']
  const limit = Number(raw['limit'] ?? '50')
  return {
    provider:
      rawProvider === 's3' || rawProvider === 'local' || rawProvider === 'bytea'
        ? rawProvider
        : undefined,
    cursor: typeof raw['cursor'] === 'string' ? raw['cursor'] : undefined,
    limit: Number.isFinite(limit) && limit >= 1 && limit <= 200 ? limit : 50,
  }
}

/**
 * One item per bucket the app exposes — the built-in `system` first, then every
 * declared bucket — each counting only the objects recorded under it. Empty when
 * no storage provider resolves: a declaration that cannot hold a byte is not a
 * bucket.
 */
export const buildBucketItems = (
  app: App
): Effect.Effect<readonly BucketAdminItem[], never, AdminReadServices> =>
  Effect.gen(function* () {
    const meta = resolveDefaultBucket()
    if (!meta) return []
    const usage = yield* degradeTo(ReadBucketUsage, 'bucket usage', EMPTY_USAGE)
    const now = DateTime.formatIso(yield* DateTime.now)
    return declaredBucketNames(app.buckets).map((name) => ({
      id: bucketIdForName(name),
      name,
      provider: meta.provider,
      region: meta.region,
      createdAt: now,
      updatedAt: now,
      _admin: {
        lastModifiedBy: null,
        deletedAt: null,
        metadata: {
          fileCount: usage.get(name)?.fileCount ?? 0,
          totalBytes: usage.get(name)?.totalBytes ?? 0,
        },
      },
    }))
  }).pipe(Effect.withSpan('admin.buckets.build-items'))

/**
 * The overview's right-edge totals. `buckets` counts what the app DECLARES;
 * `files` / `totalBytes` are the backend's global figures. Declared buckets are
 * path prefixes inside the one env-resolved backend, so they all land under the
 * same provider key — which keeps `by_provider` summing to `buckets`.
 */
export const buildOverviewTotals = (
  app: App
): Effect.Effect<BucketsOverviewResponse['totals'], never, AdminReadServices> =>
  Effect.gen(function* () {
    const meta = resolveDefaultBucket()
    if (!meta) {
      return { buckets: 0, files: 0, totalBytes: 0, by_provider: { s3: 0, local: 0, bytea: 0 } }
    }
    const buckets = declaredBucketNames(app.buckets).length
    const { fileCount, totalBytes } = yield* degradeTo(
      Effect.gen(function* () {
        const storage = yield* StorageService
        const [bytes, keys] = yield* Effect.all([storage.getTotalBytes, storage.list('')])
        return { totalBytes: bytes, fileCount: keys.length }
      }),
      'storage totals',
      { totalBytes: 0, fileCount: 0 }
    )
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
  }).pipe(Effect.withSpan('admin.buckets.overview-totals'))
