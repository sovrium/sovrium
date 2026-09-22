/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the Native Admin Dashboard GLOBAL INDEXED SEARCH
 * (`GET /api/admin/search?q=`, [internal ref]) — the admin-only, fully-indexed
 * search that spans EVERY admin entity kind in one full-text query and returns
 * the matches GROUPED BY TYPE.
 *
 * Flow:
 *   1. Probe the index freshness ({@link AdminSearchRepository.indexStaleness}).
 *   2. If the index is empty OR older than {@link FRESHNESS_WINDOW_MS}, rebuild
 *      it on demand — reading each entity kind's EXISTING data source (table
 *      records, form submissions, automation runs, users, file names, agent
 *      conversations) AND the live `app.connections[]` config (a secret-free
 *      label), upserting one secret-free row per entity. This is the deliberate
 *      LAZY-rebuild staleness tradeoff documented on the response model: a very
 *      recent mutation can lag by up to the rebuild window.
 *   3. Run the dialect-dispatched full-text query.
 *   4. Project the matched index rows to the S4 allow-list response, grouped by
 *      kind in the canonical order, capped per group.
 *
 * The application layer owns ALL projection/derivation; only the raw reads (the
 * index probe, rebuild upserts, FTS query) live in the infrastructure
 * repository, reused via {@link AdminSearchRepository}. Connections are indexed
 * HERE from the in-memory config (no DB read), mirroring how the connections
 * admin list derives its secret-free shape.
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
import {
  componentTypePath,
  DESIGN_SYSTEM_NAV_CHILDREN,
} from '@/domain/models/app/admin/admin-data-nav'
import {
  CATALOG_CATEGORY_TITLES,
  CATALOG_COMPONENT_CATEGORIES,
  catalogedTypesOf,
} from '@/domain/models/app/pages/components/component-types/catalog'
import { AdminSearchRepositoryLive } from '@/infrastructure/database/repositories/admin-search-repository-live'
import type { App } from '@/domain/models/app'

/**
 * Deep-readonly mirrors of the Zod-inferred response shapes
 * ({@link AdminSearchResult} / {@link AdminSearchGroup} / {@link AdminSearchResponse}).
 * The use case is written against these (so `functional/prefer-immutable-types`
 * holds end to end); the route re-validates the assembled object against the
 * `.strict()` Zod schema (`adminSearchResponseSchema`) before serializing, where
 * the readonly pipeline and the Zod-inferred mutable shape converge. Defining
 * them as `Readonly<…>` of the canonical types keeps the two in lock-step — a
 * schema field change propagates here at compile time.
 */
type ResultEntry = Readonly<AdminSearchResult>

interface GroupEntry {
  readonly type: AdminSearchGroup['type']
  readonly results: readonly ResultEntry[]
}

export interface AdminSearchProgramResponse {
  readonly query: AdminSearchResponse['query']
  readonly groups: readonly GroupEntry[]
}

/** Field types whose physical columns hold searchable text (mirrors command-search). */
const TEXT_FIELD_TYPES = new Set(['single-line-text', 'long-text', 'rich-text', 'email', 'url'])

/**
 * The freshness window for the lazy rebuild. The index is rebuilt when it is
 * empty OR its newest row is older than this. Kept short so a record created a
 * moment ago surfaces within the spec's poll budget (the staleness tradeoff is
 * intentional — see the response-model JSDoc).
 */
const FRESHNESS_WINDOW_MS = 2000

/** Max results returned per type group (most-recent first). */
const PER_GROUP_CAP = 25

/**
 * Build the secret-free connection index rows from the live config. Each
 * connection's `title` is its human label (falling back to the kebab `name`) —
 * NEVER a token/credential (S4). The deep-link is the connections surface.
 */
const connectionRows = (app: App): readonly AdminSearchUpsertRow[] =>
  (app.connections ?? []).map((connection) => ({
    type: 'connection' as const,
    entityId: connection.name,
    title: connection.label ?? connection.name,
    body: connection.description ?? '',
    href: '/_admin/connections',
    updatedAt: new Date(),
  }))

/**
 * The words every design-system row carries in its `body` so the section is
 * findable by its own name.
 *
 * ─── WHY THE HAYSTACK IS NOT THE LABEL ─────────────────────────────────────
 *
 * `body` is indexed and never returned: the FTS document is `title || ' ' ||
 * body`, while {@link toResult} projects only the four scalars the `.strict()`
 * S4 allow-list permits. So a row can be findable by a word it does not display
 * — which is the whole reason a component type can be reached by typing
 * `overlays` without the palette growing a second line of text per result.
 *
 * Both families carry it, and that is deliberate rather than incidental: a
 * query for `design` has to match MANY component types at once, because that is
 * the exact case two separate kinds exist to survive. The catalogue holds an
 * order of magnitude more types than the console has destinations, and both
 * exceed the row budget on their own — so with ONE kind the types would crowd
 * every destination out of view. With two, each has its own budget and
 * `[internal ref]` can prove it.
 *
 * No count is written here on purpose. Both populations are derived
 * (`DESIGN_SYSTEM_NAV_CHILDREN`, `CATALOG_COMPONENT_CATEGORIES`), so a literal
 * would be a hand-kept copy of a number nothing reads — the same silent rot the
 * block below warns about, and the reason this paragraph once said 85 and 7
 * against a real 89 and 6.
 */
const DESIGN_HAYSTACK = 'Design system console'

/**
 * The console's design-system destinations, as index rows — one per nav child.
 *
 * Derived from `DESIGN_SYSTEM_NAV_CHILDREN` — the same list the sidebar renders
 * — rather than typed out here. A hand-kept copy would be a second nav that
 * goes stale the first time a page is added, and it would go stale SILENTLY:
 * a destination missing from the palette looks exactly like a query that did
 * not match it.
 *
 * The Overview's href is the section ROOT (`/_admin/design-system`) and not
 * `/design-system/overview`, because that is the URL the nav itself carries;
 * deriving is what keeps the two from disagreeing about which of the two
 * addresses a page has.
 */
const designConsoleRows = (): readonly AdminSearchUpsertRow[] =>
  DESIGN_SYSTEM_NAV_CHILDREN.map((child) => ({
    type: 'design-console' as const,
    entityId: child.key,
    title: child.label,
    body: `${DESIGN_HAYSTACK} — ${child.label}`,
    href: child.href,
    updatedAt: new Date(),
  }))

/**
 * One row per catalogued component type, deep-linking to its own type page.
 *
 * ─── THE SEGMENT IS THE TYPE LITERAL, AND SLUGIFYING IT IS THE TRAP ────────
 *
 * The href comes from `componentTypePath` — the one place the console's
 * per-type address is composed — rather than from a string formed here. The
 * catalogue used to hold camelCase types (`commentCount`, `pageSearch`,
 * `searchInput`), so a kebab-casing guess shipped plausible-looking rows that
 * 404 when followed. All three were retired by the catalogue merges; sharing
 * the builder is what keeps the rule true for the next one, and what makes the
 * palette follow the route if the route ever moves instead of drifting from it.
 *
 * `title` is the type literal alone. It is unique across the whole catalogue —
 * `admin-data-nav.test.ts` and the catalogue's own tests are what hold that, not
 * a count written here — so a category would add recognition rather than
 * disambiguation; and carrying one
 * would mean either widening the `.strict()` S4 allow-list for every kind or
 * folding two facts into the one field the schema calls the result line. The
 * category goes in `body` instead, where it is searchable and not displayed.
 */
const componentTypeRows = (): readonly AdminSearchUpsertRow[] =>
  CATALOG_COMPONENT_CATEGORIES.flatMap((category) =>
    catalogedTypesOf(category).map((type) => ({
      type: 'component-type' as const,
      entityId: type,
      title: type,
      body: `${DESIGN_HAYSTACK} — ${CATALOG_CATEGORY_TITLES[category]}`,
      href: componentTypePath(type),
      updatedAt: new Date(),
    }))
  )

/**
 * Every STATIC row the index carries — rows projected from the registry rather
 * than read from a table.
 *
 * They ride the SAME `extraRows` seam `connectionRows` already uses. A second
 * mechanism would mean a second freshness story and a second place to look when
 * a row is missing, for rows that are cheaper to rebuild than to invalidate.
 */
export const designSystemRows = (): readonly AdminSearchUpsertRow[] => [
  ...designConsoleRows(),
  ...componentTypeRows(),
]

/** The per-table text-column descriptors the rebuild scans for record rows. */
const tableDescriptors = (
  app: App
): ReadonlyArray<{ readonly displayName: string; readonly textColumns: readonly string[] }> =>
  (app.tables ?? []).map((table) => ({
    displayName: table.name,
    textColumns: (table.fields ?? [])
      .filter((field) => TEXT_FIELD_TYPES.has(field.type))
      .map((field) => field.name),
  }))

/** Whether the index needs a rebuild (empty OR past the freshness window). */
const isStale = (state: {
  readonly isEmpty: boolean
  readonly lastBuiltAt: Date | undefined
}): boolean => {
  if (state.isEmpty || state.lastBuiltAt === undefined) return true
  return Date.now() - state.lastBuiltAt.getTime() > FRESHNESS_WINDOW_MS
}

/** Coerce a dialect-native timestamp to an ISO 8601 string. */
const toIso = (raw: Readonly<Date> | string | number): string => {
  if (typeof raw === 'number') return new Date(raw).toISOString()
  if (typeof raw !== 'string') return raw.toISOString()
  // String form — numeric epoch (some SQLite drivers) vs ISO string.
  const asNumber = Number(raw)
  return Number.isFinite(asNumber) && /^\d+$/.test(raw)
    ? new Date(asNumber).toISOString()
    : new Date(raw).toISOString()
}

/** Project one raw index hit to the S4 allow-list result. */
const toResult = (hit: Readonly<AdminSearchIndexHit>): ResultEntry => ({
  type: hit.type,
  entityId: hit.entityId,
  title: hit.title,
  href: hit.href,
  updatedAt: toIso(hit.updatedAt),
})

/** Build the results for one entity kind (most-recent first, capped). */
const groupFor = (
  hits: readonly AdminSearchIndexHit[],
  type: AdminSearchEntityType
): readonly ResultEntry[] =>
  hits
    .filter((hit) => hit.type === type)
    .map(toResult)
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, PER_GROUP_CAP)

/**
 * Group matched hits by entity kind in the canonical order, most-recent first
 * within each group, capped per group. Kinds with no match are omitted.
 */
const groupHits = (hits: readonly AdminSearchIndexHit[]): readonly GroupEntry[] =>
  adminSearchEntityTypes.flatMap((type: AdminSearchEntityType): readonly GroupEntry[] => {
    const results = groupFor(hits, type)
    return results.length > 0 ? [{ type, results }] : []
  })

/**
 * Run the admin global search for `query`. An empty/whitespace query short-
 * circuits to an empty body (a 200 with no groups) WITHOUT touching the index.
 */
export const SearchAdminGlobal = (
  app: App,
  rawQuery: string
): Effect.Effect<AdminSearchProgramResponse, AdminSearchDatabaseError, AdminSearchRepository> =>
  Effect.gen(function* () {
    const query = rawQuery.trim()
    if (query.length === 0) return { query, groups: [] }

    const repo = yield* AdminSearchRepository

    // Lazy rebuild: repopulate the index when it is empty or stale.
    const staleness = yield* repo.indexStaleness
    if (isStale(staleness)) {
      yield* repo.rebuildIndex({
        tables: tableDescriptors(app),
        extraRows: [...connectionRows(app), ...designSystemRows()],
      })
    }

    const hits = yield* repo.search(query)
    return { query, groups: groupHits(hits) }
  }).pipe(Effect.withSpan('admin.search-admin-global'))

/**
 * Application layer for the admin global-search use case.
 */
export const AdminSearchLayer = Layer.mergeAll(AdminSearchRepositoryLive)
