/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  AdminSearchRepository,
  type AdminSearchDatabaseError,
  type AdminSearchIndexHit,
  type AdminSearchUpsertRow,
} from '@/application/ports/repositories/admin-search-repository'
import {
  adminSearchEntityTypes,
  type AdminSearchEntityType,
  type AdminSearchGroup,
  type AdminSearchResponse,
  type AdminSearchResult,
} from '@/domain/models/api/admin/search/search'
import { AdminSearchRepositoryLive } from '@/infrastructure/database/repositories/admin-search-repository-live'
import type { App } from '@/domain/models/app'

type ResultEntry = Readonly<AdminSearchResult>

interface GroupEntry {
  readonly type: AdminSearchGroup['type']
  readonly results: readonly ResultEntry[]
}

export interface AdminSearchProgramResponse {
  readonly query: AdminSearchResponse['query']
  readonly groups: readonly GroupEntry[]
}

const TEXT_FIELD_TYPES = new Set(['single-line-text', 'long-text', 'rich-text', 'email', 'url'])

const FRESHNESS_WINDOW_MS = 2000

const PER_GROUP_CAP = 25

const connectionRows = (app: App): readonly AdminSearchUpsertRow[] =>
  (app.connections ?? []).map((connection) => ({
    type: 'connection' as const,
    entityId: connection.name,
    title: connection.label ?? connection.name,
    body: connection.description ?? '',
    href: '/_admin/connections',
    updatedAt: new Date(),
  }))

const tableDescriptors = (
  app: App
): ReadonlyArray<{ readonly displayName: string; readonly textColumns: readonly string[] }> =>
  (app.tables ?? []).map((table) => ({
    displayName: table.name,
    textColumns: (table.fields ?? [])
      .filter((field) => TEXT_FIELD_TYPES.has(field.type))
      .map((field) => field.name),
  }))

const isStale = (state: {
  readonly isEmpty: boolean
  readonly lastBuiltAt: Date | undefined
}): boolean => {
  if (state.isEmpty || state.lastBuiltAt === undefined) return true
  return Date.now() - state.lastBuiltAt.getTime() > FRESHNESS_WINDOW_MS
}

const toIso = (raw: Readonly<Date> | string | number): string => {
  if (typeof raw === 'number') return new Date(raw).toISOString()
  if (typeof raw !== 'string') return raw.toISOString()
  const asNumber = Number(raw)
  return Number.isFinite(asNumber) && /^\d+$/.test(raw)
    ? new Date(asNumber).toISOString()
    : new Date(raw).toISOString()
}

const toResult = (hit: Readonly<AdminSearchIndexHit>): ResultEntry => ({
  type: hit.type,
  entityId: hit.entityId,
  title: hit.title,
  href: hit.href,
  updatedAt: toIso(hit.updatedAt),
})

const groupFor = (
  hits: readonly AdminSearchIndexHit[],
  type: AdminSearchEntityType
): readonly ResultEntry[] =>
  hits
    .filter((hit) => hit.type === type)
    .map(toResult)
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, PER_GROUP_CAP)

const groupHits = (hits: readonly AdminSearchIndexHit[]): readonly GroupEntry[] =>
  adminSearchEntityTypes.flatMap((type: AdminSearchEntityType): readonly GroupEntry[] => {
    const results = groupFor(hits, type)
    return results.length > 0 ? [{ type, results }] : []
  })

export const SearchAdminGlobal = (
  app: App,
  rawQuery: string
): Effect.Effect<AdminSearchProgramResponse, AdminSearchDatabaseError, AdminSearchRepository> =>
  Effect.gen(function* () {
    const query = rawQuery.trim()
    if (query.length === 0) return { query, groups: [] }

    const repo = yield* AdminSearchRepository

    const staleness = yield* repo.indexStaleness()
    if (isStale(staleness)) {
      yield* repo.rebuildIndex({
        tables: tableDescriptors(app),
        extraRows: connectionRows(app),
      })
    }

    const hits = yield* repo.search(query)
    return { query, groups: groupHits(hits) }
  })

export const AdminSearchLayer = Layer.mergeAll(AdminSearchRepositoryLive)
