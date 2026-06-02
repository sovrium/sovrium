/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  CommandSearchRepository,
  type CommandSearchDatabaseError,
} from '@/application/ports/repositories/command-search-repository'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { CommandSearchRepositoryLive } from '@/infrastructure/database/repositories/command-search-repository-live'
import type { App } from '@/domain/models/app'


const TEXT_FIELD_TYPES = new Set(['single-line-text', 'long-text', 'rich-text', 'email', 'url'])

export interface CommandSearchResult {
  readonly entityType: 'record' | 'page'
  readonly entityId: string
  readonly tableName?: string
  readonly label: string
  readonly favorited: boolean
  readonly detailPath?: string
}

const collectComponentDataSources = (
  component: unknown
): readonly NonNullable<App['pages']>[number]['dataSource'][] => {
  if (component === null || typeof component !== 'object') return []
  const node = component as {
    readonly dataSource?: NonNullable<App['pages']>[number]['dataSource']
    readonly children?: unknown
  }
  const own = node.dataSource ? [node.dataSource] : []
  const children = Array.isArray(node.children) ? node.children : []
  return [...own, ...children.flatMap((child) => collectComponentDataSources(child))]
}

const buildDetailPathMap = (app: App): ReadonlyMap<string, string> => {
  const entries = (app.pages ?? []).flatMap((page) => {
    const componentSources = (page.components ?? []).flatMap((component) =>
      collectComponentDataSources(component)
    )
    const allSources = [page.dataSource, ...componentSources]
    return allSources.flatMap((source) =>
      source && source.mode === 'single' && typeof page.path === 'string'
        ? ([[source.table, page.path]] as const)
        : []
    )
  })
  return new Map(entries)
}

const resolveDetailPath = (
  detailPathMap: ReadonlyMap<string, string>,
  tableName: string,
  recordId: string
): string | undefined => {
  const template = detailPathMap.get(tableName)
  if (template === undefined) return undefined
  const resolved = template.replace(/:[a-zA-Z0-9_]+/, encodeURIComponent(recordId))
  return resolved === template ? undefined : resolved
}

const searchPages = (app: App, query: string): readonly CommandSearchResult[] => {
  const needle = query.toLowerCase()
  return (app.pages ?? []).flatMap((page) => {
    if (typeof page.path !== 'string' || page.path.includes(':')) return []
    const title =
      typeof page.meta?.title === 'string' && page.meta.title.length > 0
        ? page.meta.title
        : page.name
    const haystack = `${title} ${page.name}`.toLowerCase()
    if (!haystack.includes(needle)) return []
    return [
      {
        entityType: 'page' as const,
        entityId: page.path,
        label: title,
        favorited: false,
        detailPath: page.path,
      },
    ]
  })
}

const searchableColumns = (table: NonNullable<App['tables']>[number]): readonly string[] =>
  (table.fields ?? [])
    .filter((field) => TEXT_FIELD_TYPES.has(field.type))
    .map((field) => field.name)

export const SearchCommandPalette = (
  app: App,
  query: string,
  userId: string | undefined
): Effect.Effect<
  readonly CommandSearchResult[],
  CommandSearchDatabaseError,
  CommandSearchRepository
> =>
  Effect.gen(function* () {
    const repo = yield* CommandSearchRepository

    const favoriteIds = userId ? yield* repo.loadFavoriteIds(userId) : new Set<string>()
    const detailPathMap = buildDetailPathMap(app)

    const tables = app.tables ?? []
    const perTable = yield* Effect.all(
      tables.map((table) =>
        Effect.gen(function* () {
          const columns = searchableColumns(table)
          if (columns.length === 0) return [] as readonly CommandSearchResult[]
          const matches = yield* repo.searchTable({
            physicalTable: sanitizeTableName(table.name),
            columns,
            query,
          })
          return matches.map(
            (match): CommandSearchResult => ({
              entityType: 'record',
              entityId: match.id,
              tableName: table.name,
              label: match.label,
              favorited: favoriteIds.has(match.id),
              detailPath: resolveDetailPath(detailPathMap, table.name, match.id),
            })
          )
        })
      ),
      { concurrency: 'unbounded' }
    )

    const flat = perTable.flat()
    const rankedRecords = [
      ...flat.filter((result) => result.favorited),
      ...flat.filter((result) => !result.favorited),
    ].slice(0, 25)

    const pages = searchPages(app, query)

    return [...pages, ...rankedRecords]
  })

export const CommandSearchLayer = Layer.mergeAll(CommandSearchRepositoryLive)
