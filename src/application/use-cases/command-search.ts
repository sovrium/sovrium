/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- The command palette search is a cross-cutting concern, not phase-specific
import { Effect, Layer } from 'effect'
import {
  CommandSearchRepository,
  type CommandSearchDatabaseError,
} from '@/application/ports/repositories/command-search-repository'
import { extractMatchExcerpt, stripMarkdownToPlainText } from '@/domain/utils/content-dir-excerpt'
import { searchableTextColumns } from '@/domain/utils/database/searchable-text-columns'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { CommandSearchRepositoryLive } from '@/infrastructure/database/repositories/command-search-repository-live'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { readContentDirBodies } from '@/infrastructure/markdown/content-dir-enumerator'
import type { App } from '@/domain/models/app'

/**
 * Use case for the global command-palette search API (`GET /api/command-search`).
 *
 * The application layer owns all pure logic:
 *   - building the `tableName -> detail page path` map (single-mode dataSources),
 *   - resolving the per-record navigation URL,
 *   - searching static pages by title/name,
 *   - ranking favorited records above non-favorited and merging pages ahead of
 *     records into the final palette response.
 *
 * Only the two raw queries (favorites load, per-table text search) live in the
 * infrastructure repository, accessed via {@link CommandSearchRepository}.
 */

/**
 * Per-source result ceiling for the two PAGE sources
 *.
 *
 * Records were already capped at 25; `searchPages` and `searchContentDirPages`
 * were not, and both are unbounded in the same way that produced the 504. A
 * documentation site is exactly the shape that breaks it: `apps/website` alone
 * serves ~204 articles per locale, so a short query against its content
 * directory serialized hundreds of results into a palette that renders roughly
 * ten of them. Total response is now bounded at 10 + 10 + 25.
 */
const PAGE_RESULT_CAP = 10

/** Record-result ceiling — unchanged, stated here beside its page siblings. */
const RECORD_RESULT_CAP = 25

/** Shape of a single palette search result (record or page). */
export interface CommandSearchResult {
  readonly entityType: 'record' | 'page'
  readonly entityId: string
  /**
   * Table the record belongs to (record results) or omitted for page results.
   * Record results are grouped by this value in the palette.
   */
  readonly tableName?: string
  readonly label: string
  readonly favorited: boolean
  /**
   * Resolved navigation target. For records this is the detail-page URL with
   * the record id substituted; for pages it is the page path itself. Omitted
   * when no navigation target can be resolved.
   */
  readonly detailPath?: string
  /**
   * A short plain-text snippet of the page body around the query match (content
   * pages only). Present only when the query matched the body text; omitted for
   * title-only matches and for record results.
   */
  readonly excerpt?: string
  /**
   * The `[start, end)` index of the matched span WITHIN {@link excerpt}, so the
   * client can wrap that slice in `<mark>` without re-running the match. Present
   * only when `excerpt` is present and the query occurs in the body.
   */
  readonly matchRange?: readonly [number, number]
}

/**
 * Recursively collect every `dataSource` declared on a component subtree
 * (component-level bindings plus their descendants).
 */
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

/**
 * Build a map of `tableName -> detail page path` by scanning every page for a
 * `single`-mode `dataSource` (page-level or component-level) bound to a table.
 *
 * The returned path is the raw page path (with its `:param` segment intact);
 * the per-record URL is produced by substituting the record id at request
 * time.
 */
const buildDetailPathMap = (app: App): ReadonlyMap<string, string> => {
  const entries = (app.pages ?? []).flatMap((page) => {
    const componentSources = (page.components ?? []).flatMap((component) =>
      collectComponentDataSources(component)
    )
    const allSources = [page.dataSource, ...componentSources]
    return allSources.flatMap((source) =>
      // A system detail-endpoint binding (`{ system }`) carries its own endpoint
      // and is NOT a table→detail-path mapping, so only DB-table sources (those
      // with a `table` key) populate the detail-path map.
      source && 'table' in source && source.mode === 'single' && typeof page.path === 'string'
        ? ([[source.table, page.path]] as const)
        : []
    )
  })
  return new Map(entries)
}

/**
 * Resolve the per-record navigation URL by substituting `recordId` into the
 * detail page path's first `:param` segment. Returns `undefined` when no
 * detail page is bound to the table or the path has no dynamic segment.
 */
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

/**
 * Match the query (case-insensitive substring) against every static page's
 * title and name. Pages with a dynamic (`:param`) segment are skipped — they
 * are record-detail templates, not navigable destinations on their own.
 *
 * `contentDir` pages are also skipped here: although their declared path is a
 * `:slug` template, the concrete markdown routes they generate are indexed
 * separately by {@link searchContentDirPages}.
 */
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

/**
 * Index the concrete markdown routes generated by every `contentDir` page and
 * match the query against each file's frontmatter title/slug AND its full
 * markdown body. Title/slug matches surface the page with no excerpt; body
 * matches additionally carry a short highlighted snippet of the body around the
 * match (see {@link extractMatchExcerpt}). Each result's `detailPath` is the
 * resolved `/prefix/slug` URL — never the un-navigable `:slug` template.
 */
const searchContentDirPages = async (
  app: App,
  query: string
): Promise<readonly CommandSearchResult[]> => {
  const needle = query.toLowerCase()
  // FAN-OUT WIDTH: unbounded, and safe for a reason that does NOT generalise to
  // this file's sibling fan-outs — every branch here is FILESYSTEM work
  // (`readContentDirBodies` reads markdown off disk), so it takes no slot in the
  // shared database connection pool that the 2026-07-25 incident exhausted. Width
  // is config-bounded by the `contentDir` pages in `app.pages`, and the per-page
  // cost is a directory read, not a query. If this ever grows a database read,
  // it needs a stated ceiling like every other fan-out in the layer.
  // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- filesystem fan-out, no pooled connection; see the FAN-OUT WIDTH note above.
  const perPage = await Promise.all(
    (app.pages ?? [])
      .filter((page) => page.contentDir !== undefined && typeof page.path === 'string')
      .map(async (page) => {
        const bodies = await readContentDirBodies(page.contentDir!, page.path)
        return bodies.flatMap(({ entry, body }): readonly CommandSearchResult[] => {
          const titleMatch = `${entry.title} ${entry.slug}`.toLowerCase().includes(needle)
          const plain = stripMarkdownToPlainText(body)
          const bodyMatch = plain.toLowerCase().includes(needle)
          if (!titleMatch && !bodyMatch) return []

          const base = {
            entityType: 'page' as const,
            entityId: entry.path,
            label: entry.title,
            favorited: false,
            detailPath: entry.path,
          }
          // A body match contributes a highlighted excerpt; a title-only match
          // surfaces the page without one.
          if (bodyMatch) {
            const { excerpt, matchStart, matchEnd } = extractMatchExcerpt(plain, query)
            return [
              {
                ...base,
                excerpt,
                ...(matchStart >= 0 ? { matchRange: [matchStart, matchEnd] as const } : {}),
              },
            ]
          }
          return [base]
        })
      })
  )
  return perPage.flat()
}

/**
 * The text column names of a table that are searchable as text.
 *
 * Delegates to the shared domain definition so this list and the one the FTS
 * index is built over cannot drift — see `domain/utils/database/
 * searchable-text-columns.ts` for why a divergence would fail closed.
 */
const searchableColumns = (table: NonNullable<App['tables']>[number]): readonly string[] =>
  searchableTextColumns(table.fields)

/**
 * Run the command-palette search for `query` on behalf of `userId` (or no user,
 * when `userId` is undefined — favorites are then skipped and every record is
 * `favorited: false`).
 *
 * Returns the merged palette response: page matches first (navigable
 * destinations surface ahead of records), then records ranked with the caller's
 * favorites boosted above non-favorited ones. Both groups preserve declaration
 * order; the record group is capped at 25.
 */
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
          return matches.map((match): CommandSearchResult => ({
            entityType: 'record',
            entityId: match.id,
            tableName: table.name,
            label: match.label,
            favorited: favoriteIds.has(match.id),
            detailPath: resolveDetailPath(detailPathMap, table.name, match.id),
          }))
        })
      ),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )

    // Favorited records rank above non-favorited ones; ordering within each
    // group is otherwise stable (table declaration order, then row order).
    const flat = perTable.flat()
    const rankedRecords = [
      ...flat.filter((result) => result.favorited),
      ...flat.filter((result) => !result.favorited),
    ].slice(0, RECORD_RESULT_CAP)

    // Page matches rank ahead of record matches in the palette so navigable
    // destinations surface first. Static pages are joined by the concrete
    // markdown routes contentDir pages generate. Each page source is capped
    // independently — see PAGE_RESULT_CAP; a content directory is unbounded by
    // config and the palette renders roughly ten rows either way.
    const pages = searchPages(app, query).slice(0, PAGE_RESULT_CAP)
    const contentDirPages = (yield* Effect.promise(() => searchContentDirPages(app, query))).slice(
      0,
      PAGE_RESULT_CAP
    )

    return [...pages, ...contentDirPages, ...rankedRecords]
  })

/**
 * Application layer for the command-palette search use case.
 */
export const CommandSearchLayer = Layer.mergeAll(CommandSearchRepositoryLive)
