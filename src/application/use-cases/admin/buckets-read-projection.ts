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
import { AdminBucketFilesRepository } from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import { ReadBucketUsage } from '@/application/use-cases/admin/bucket-files'
import { readableName } from '@/domain/models/app/auth/readable-name-service'
import {
  bucketIdForName,
  declaredBucketNames,
  SYSTEM_BUCKET_NAME,
} from '@/domain/models/app/buckets/bucket-identity'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { Logger } from '@/infrastructure/logging/logger'
import type { ConsoleLanguage } from '@/application/use-cases/admin/operator-language'
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
 * The upload rules a bucket declares, read verbatim from its `buckets[]` entry.
 * An omitted rule reads as its documented default (not public, no own size
 * cap, every type accepted); the built-in `system` bucket declares none.
 */
const declaredUploadRules = (
  app: App,
  name: string
): Pick<BucketAdminItem, 'public' | 'maxFileSize' | 'allowedMimeTypes'> => {
  const declared =
    name === SYSTEM_BUCKET_NAME ? undefined : app.buckets?.find((bucket) => bucket.name === name)
  return {
    public: declared?.public ?? false,
    maxFileSize: declared?.maxFileSize ?? null,
    allowedMimeTypes: declared?.allowedMimeTypes ?? null,
  }
}

/** What the console calls the built-in bucket, per console language. */
const SYSTEM_BUCKET_WORDS: Readonly<Record<ConsoleLanguage, string>> = {
  en: 'System',
  fr: 'Système',
}

/**
 * The words the console prints for a bucket, in `language`: the built-in one is
 * named in the operator's language, as the built-in agent is; a declared bucket
 * declares no label, so a person reads its name made readable.
 */
const bucketLabelOf = (name: string, language: ConsoleLanguage): string =>
  name === SYSTEM_BUCKET_NAME ? SYSTEM_BUCKET_WORDS[language] : readableName(name)

/** What a declared bucket says it holds, as a key to spread: none when it declares nothing. */
const declaredDescription = (app: App, name: string): { readonly description?: string } => {
  const description = app.buckets?.find((bucket) => bucket.name === name)?.description
  return description?.trim() ? { description } : {}
}

/**
 * One item per bucket the app exposes — the built-in `system` first, then every
 * declared bucket — each counting only the objects recorded under it. Empty when
 * no storage provider resolves: a declaration that cannot hold a byte is not a
 * bucket.
 */
export const buildBucketItems = (
  app: App,
  language: ConsoleLanguage
): Effect.Effect<readonly BucketAdminItem[], never, AdminBucketFilesRepository | Logger> =>
  Effect.gen(function* () {
    const meta = resolveDefaultBucket()
    if (!meta) return []
    const usage = yield* degradeTo(ReadBucketUsage, 'bucket usage', EMPTY_USAGE)
    const now = DateTime.formatIso(yield* DateTime.now)
    return declaredBucketNames(app.buckets).map((name) => ({
      id: bucketIdForName(name),
      name,
      label: bucketLabelOf(name, language),
      ...declaredDescription(app, name),
      provider: meta.provider,
      region: meta.region,
      ...declaredUploadRules(app, name),
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
 * `files` / `totalBytes` are one count-and-sum read of the storage catalog —
 * the corpus the series sums, so the two agree by construction, and an object
 * the app did not store (no catalog row) is never counted. The store itself is
 * never listed. Declared buckets are path prefixes inside the one env-resolved
 * backend, so they all land under the same provider key — which keeps
 * `by_provider` summing to `buckets`.
 */
export const buildOverviewTotals = (
  app: App
): Effect.Effect<BucketsOverviewResponse['totals'], never, AdminBucketFilesRepository | Logger> =>
  Effect.gen(function* () {
    const meta = resolveDefaultBucket()
    if (!meta) {
      return { buckets: 0, files: 0, totalBytes: 0, by_provider: { s3: 0, local: 0, bytea: 0 } }
    }
    const buckets = declaredBucketNames(app.buckets).length
    const catalog = yield* degradeTo(
      Effect.gen(function* () {
        const repo = yield* AdminBucketFilesRepository
        return yield* repo.summariseCatalog
      }),
      'storage totals',
      { files: 0, bytes: 0 }
    )
    return {
      buckets,
      files: catalog.files,
      totalBytes: catalog.bytes,
      by_provider: {
        s3: meta.provider === 's3' ? buckets : 0,
        local: meta.provider === 'local' ? buckets : 0,
        bytea: meta.provider === 'bytea' ? buckets : 0,
      },
    }
  }).pipe(Effect.withSpan('admin.buckets.overview-totals'))
