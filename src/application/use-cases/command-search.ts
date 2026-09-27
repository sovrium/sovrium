/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- The command palette search is a cross-cutting concern, not phase-specific
import { Effect } from 'effect'
import {
  CommandSearchRepository,
  type CommandSearchDatabaseError,
} from '@/application/ports/repositories/command-search-repository'
import { loadReadablePageDocuments } from '@/application/use-cases/page-search-corpus'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { searchPageDocuments } from '@/domain/models/app/pages/page-search-corpus-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type ReadPrincipal,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { searchableTextColumns } from '@/domain/models/app/tables/searchable-text-columns'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

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
 * Records were already capped at 25; the declared-page and article matches
 * were not, and both are unbounded in the same way that produced the 504. A
 * documentation site is exactly the shape that breaks it: a short query against
 * `apps/website`'s content directory matches a large fraction of its articles,
 * and serialized every one of them into a palette that renders roughly ten.
 * Total response is now bounded at 10 + 10 + 25.
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
 * The text column names of a table that are searchable as text.
 *
 * Delegates to the shared domain definition so this list and the one the FTS
 * index is built over cannot drift — see `domain/utils/database/
 * searchable-text-columns.ts` for why a divergence would fail closed.
 */
const searchableColumns = (table: NonNullable<App['tables']>[number]): readonly string[] =>
  searchableTextColumns(table.fields)

/**
 * How far the RECORD half of a palette search may reach.
 *
 * The palette answers with two kinds of result and they carry different risk.
 * PAGE results are declared static pages and `contentDir` markdown, filtered by
 * the page-access check the router applies — so an anonymous reader searching a
 * public documentation site is a legitimate, load-bearing use, and a gated page
 * answers only a reader who may open it. RECORD results are table rows, and the result `label` is a raw
 * value from whichever text column matched.
 *
 * Collapsing the two into one gate is what made the endpoint an anonymous read
 * primitive over the whole database — and gating the whole endpoint on a
 * session would break the public docs search. Hence three states, not two.
 */
export type RecordSearchScope =
  /** The app configures no `auth`: the full-access model, as everywhere else. */
  | { readonly kind: 'unrestricted' }
  /** Auth IS configured and the caller has no session: pages only, no rows. */
  | { readonly kind: 'pages-only' }
  /** A signed-in caller: rows scoped by the composed read plan. */
  | { readonly kind: 'scoped'; readonly principal: ReadPrincipal }

/**
 * The searchable columns of a table THIS caller may read.
 *
 * An empty result means the table is not scanned at all — either the caller
 * cannot read it, or records are out of scope entirely.
 */
const searchableColumnsFor = (
  app: App,
  table: NonNullable<App['tables']>[number],
  scope: RecordSearchScope
): readonly string[] => {
  if (scope.kind === 'pages-only') return []
  const columns = searchableColumns(table)
  if (scope.kind === 'unrestricted' || columns.length === 0) return columns
  const plan = buildReadAccessPlan({
    app,
    table: table as TableLike,
    principal: scope.principal,
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return []
  // A restricted column is not matched against, so its values cannot surface as
  // a result `label` — the palette must not become an oracle over a column the
  // records API strips from the response.
  return columns.filter((column) => !plan.restrictedColumns.has(column))
}

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
/**
 * The page half of the palette: declared pages matched by title and name,
 * `contentDir` articles by title, slug AND body (with an excerpt) — each capped
 * independently at {@link PAGE_RESULT_CAP}.
 *
 * The candidates are the reader's own page corpus, filtered by the router's
 * page-access check: a visitor gets public pages only, and a member never gets
 * an admin-only article — nor, through `excerpt`, a word of one. The palette
 * used to match every declared page and every article for every caller.
 */
const pageResults = (
  app: App,
  query: string,
  pageReader: SessionInfo | undefined
): Effect.Effect<readonly CommandSearchResult[], never> =>
  Effect.gen(function* () {
    const documents = yield* loadReadablePageDocuments(app, pageReader)
    const search = (kind: 'page' | 'article') =>
      searchPageDocuments(
        documents.filter((document) => document.kind === kind),
        query,
        { matchText: (matched) => matched === 'article', limit: PAGE_RESULT_CAP }
      )
    return [...search('page'), ...search('article')].map((hit): CommandSearchResult => ({
      entityType: 'page',
      entityId: hit.url,
      label: hit.title,
      favorited: false,
      detailPath: hit.url,
      ...(hit.excerpt !== undefined ? { excerpt: hit.excerpt } : {}),
      ...(hit.matchRange !== undefined ? { matchRange: hit.matchRange } : {}),
    }))
  })

/** Who is asking: favorites + record scope, and the reader the page half answers for. */
export interface CommandSearchCaller {
  readonly userId: string | undefined
  readonly scope: RecordSearchScope
  readonly pageReader: SessionInfo | undefined
}

export const SearchCommandPalette = (
  app: App,
  query: string,
  caller: CommandSearchCaller
): Effect.Effect<
  readonly CommandSearchResult[],
  CommandSearchDatabaseError,
  CommandSearchRepository
> =>
  Effect.gen(function* () {
    const repo = yield* CommandSearchRepository

    const { userId, scope, pageReader } = caller
    const favoriteIds = userId ? yield* repo.loadFavoriteIds(userId) : new Set<string>()
    const detailPathMap = buildDetailPathMap(app)

    const tables = app.tables ?? []
    const perTable = yield* Effect.all(
      tables.map((table) =>
        Effect.gen(function* () {
          // PERMISSION SCOPING. This scan used to walk EVERY table and EVERY
          // text column with no gate whatsoever, and its `label` is a raw value
          // from whichever column matched — so a `read: ['admin']` table's
          // contents were searchable, and a field-restricted column was a
          // perfectly good needle. The plan supplies the same three answers the
          // records API composes: may this caller read the table, which columns,
          // and are soft-deleted rows in scope.
          const columns = searchableColumnsFor(app, table, scope)
          if (columns.length === 0) return [] as readonly CommandSearchResult[]
          const matches = yield* repo.searchTable({
            physicalTable: sanitizeTableName(table.name),
            columns,
            query,
            // A soft-deleted record is deleted. It stayed searchable — and its
            // values readable through `label` — because no query this use case
            // issued carried the filter every other read path applies.
            excludeDeleted: true,
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
    // destinations surface first — see `pageResults` for the access filter.
    const pages = yield* pageResults(app, query, pageReader)

    return [...pages, ...rankedRecords]
  }).pipe(Effect.withSpan('command-search.search-command-palette'))
