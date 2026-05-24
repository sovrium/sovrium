/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, isNull, sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { db } from '@/infrastructure/database'
import { userFavorites } from '@/infrastructure/database/drizzle/schema/favorites'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


const TEXT_FIELD_TYPES = new Set(['single-line-text', 'long-text', 'rich-text', 'email', 'url'])

interface CommandSearchResult {
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

const loadFavoriteIds = async (userId: string): Promise<ReadonlySet<string>> => {
  const rows = await db
    .select({ entityId: userFavorites.entityId })
    .from(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.entityType, 'record'),
        isNull(userFavorites.deletedAt)
      )
    )
  return new Set(rows.map((row) => row.entityId))
}

const searchTable = async (
  table: NonNullable<App['tables']>[number],
  query: string
): Promise<readonly { readonly id: string; readonly label: string }[]> => {
  const textColumns = (table.fields ?? [])
    .filter((field) => TEXT_FIELD_TYPES.has(field.type))
    .map((field) => field.name)
  if (textColumns.length === 0) return []

  const physicalTable = sanitizeTableName(table.name)
  const pattern = `%${query}%`

  const predicate = sql.join(
    textColumns.map((column) => sql`LOWER(${sql.identifier(column)}) LIKE LOWER(${pattern})`),
    sql` OR `
  )
  const labelExpr = sql.join(
    textColumns.map((column) => sql.identifier(column)),
    sql`, `
  )

  try {
    const rows = (await db.execute(
      sql`SELECT id, COALESCE(${labelExpr}) AS __label
          FROM ${sql.identifier(physicalTable)}
          WHERE ${predicate}
          LIMIT 25`
    )) as unknown as readonly Record<string, unknown>[]
    return rows.map((row) => ({
      id: String(row['id']),
      label: typeof row['__label'] === 'string' ? row['__label'] : String(row['id']),
    }))
  } catch {
    return []
  }
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

const buildSearchHandler =
  (app: App) =>
  async (c: Context): Promise<Response> => {
    const session = getSessionContext(c)
    const query = (c.req.query('q') ?? '').trim()
    if (query.length === 0) return c.json([], 200)

    const favoriteIds = session ? await loadFavoriteIds(session.userId) : new Set<string>()
    const detailPathMap = buildDetailPathMap(app)

    const tables = app.tables ?? []
    const perTable = await Promise.all(
      tables.map(async (table) => {
        const matches = await searchTable(table, query)
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
    )

    const flat = perTable.flat()
    const rankedRecords = [
      ...flat.filter((result) => result.favorited),
      ...flat.filter((result) => !result.favorited),
    ].slice(0, 25)

    const pages = searchPages(app, query)

    return c.json([...pages, ...rankedRecords], 200)
  }

export function chainCommandSearchRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp.get('/api/command-search', buildSearchHandler(app)) as T
}
