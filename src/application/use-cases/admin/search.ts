/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the Native Admin Dashboard GLOBAL INDEXED SEARCH
 * (`GET /api/admin/search?q=`) — the admin-only, fully-indexed
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

import { Effect } from 'effect'
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
import { DESIGN_SYSTEM_NAV_CHILDREN } from '@/domain/models/app/admin/admin-data-nav'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { isCapabilityMet } from '@/domain/models/app/pages/page-requires'
import { declaresWriteOnly } from '@/domain/models/app/tables/write-only-field-service'
import type { App } from '@/domain/models/app'
import type { PageCapability } from '@/domain/models/app/pages/requires'

/**
 * Deep-readonly mirrors of the schema-inferred response shapes
 * ({@link AdminSearchResult} / {@link AdminSearchGroup} / {@link AdminSearchResponse}).
 * The use case is written against these (so `functional/prefer-immutable-types`
 * holds end to end); the route re-validates the assembled object against the
 * `.strict()` Zod schema (`adminSearchResponseSchema`) before serializing, where
 * the readonly pipeline and the schema-inferred mutable shape converge. Defining
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

/**
 * The kinds the index produces today, in the canonical group order. A stored
 * row of any other kind was written by an older version for a page the console
 * no longer has: the search never returns it, and the next rebuild deletes it,
 * so an existing database heals without a migration.
 */
const PRODUCED_KINDS: readonly AdminSearchEntityType[] = adminSearchEntityTypes.filter(
  (type) => type !== 'component-type'
)

/**
 * The kinds rebuilt from the config alone, listed in full on every rebuild:
 * a stored row of one of them that the rebuild did not list (a connection
 * removed from the config, a design-system page no longer served) is deleted.
 */
const CONFIG_KINDS: readonly AdminSearchEntityType[] = ['connection', 'design-console']

/**
 * The kinds whose index row is dated by the moment its entity happened — a
 * submission received, a run started, a file uploaded, a conversation last
 * written, an account created — and so carry `occurredAt`. A config-derived
 * row happened nowhere, and a record row is dated by the rebuild.
 */
const SOURCE_TIMED_KINDS: ReadonlySet<AdminSearchEntityType> = new Set([
  'submission',
  'run',
  'user',
  'file',
  'conversation',
])

/** Each form's title for people, by name, in the app's default language. */
const formTitles = (app: App): Readonly<Record<string, string>> =>
  Object.fromEntries(
    (app.forms ?? []).map((form) => [
      form.name,
      resolveTranslationPattern(form.title, app.languages?.default ?? 'en', app.languages),
    ])
  )

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
 * — which is what lets a destination be reached by typing `design` without
 * the palette growing a second line of text per result.
 *
 * ─── NO COMPONENT-TYPE ROWS ────────────────────────────────────────────────
 *
 * The index once carried one row per catalogued component type, deep-linking
 * to a per-type UI-kit page. That page left the console and its address now
 * answers 404, so those rows are no longer projected: a palette result that
 * 404s when followed is worse than no result. The `component-type` kind stays
 * in the wire vocabulary, unproduced — and is not in {@link PRODUCED_KINDS}, so
 * a row an older version wrote is neither returned nor kept by a rebuild.
 */
const DESIGN_HAYSTACK = 'Design system console'

/**
 * What each design-system page `requires` of the operator's app — the same
 * capability its console page declares, so a page that answers 404 for this app
 * is never a palette row. A page absent from the map is served to every app.
 */
const DESIGN_PAGE_REQUIRES: Readonly<Record<string, PageCapability>> = {
  components: 'components',
  brand: 'design.brand',
  voice: 'design.voice',
}

/** Whether the design-system page keyed `key` is served for `app`. */
const designPageIsServed = (app: App, key: string): boolean => {
  const required = DESIGN_PAGE_REQUIRES[key]
  return required === undefined || isCapabilityMet(app, required)
}

/**
 * The console's design-system destinations this app has, as index rows — one
 * per nav child whose page is served for it.
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
const designConsoleRows = (app: App): readonly AdminSearchUpsertRow[] =>
  DESIGN_SYSTEM_NAV_CHILDREN.filter((child) => designPageIsServed(app, child.key)).map((child) => ({
    type: 'design-console' as const,
    entityId: child.key,
    title: child.label,
    body: `${DESIGN_HAYSTACK} — ${child.label}`,
    href: child.href,
    updatedAt: new Date(),
  }))

/**
 * Every STATIC row the index carries — rows projected from a constant rather
 * than read from a table.
 *
 * They ride the SAME `extraRows` seam `connectionRows` already uses. A second
 * mechanism would mean a second freshness story and a second place to look when
 * a row is missing, for rows that are cheaper to rebuild than to invalidate.
 */
export const designSystemRows = (app: App): readonly AdminSearchUpsertRow[] =>
  designConsoleRows(app)

/** The per-table text-column descriptors the rebuild scans for record rows. */
const tableDescriptors = (
  app: App
): ReadonlyArray<{ readonly displayName: string; readonly textColumns: readonly string[] }> =>
  (app.tables ?? []).map((table) => ({
    displayName: table.name,
    textColumns: (table.fields ?? [])
      // A write-only value is indexed for no one: it would title a result.
      .filter((field) => TEXT_FIELD_TYPES.has(field.type) && !declaresWriteOnly(field))
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
const toResult = (hit: Readonly<AdminSearchIndexHit>): ResultEntry => {
  const updatedAt = toIso(hit.updatedAt)
  return {
    type: hit.type,
    entityId: hit.entityId,
    title: hit.title,
    href: hit.href,
    updatedAt,
    ...(SOURCE_TIMED_KINDS.has(hit.type) ? { occurredAt: updatedAt } : {}),
  }
}

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
 * within each group, capped per group. Kinds with no match are omitted, and so
 * is any kind the index no longer produces.
 */
const groupHits = (hits: readonly AdminSearchIndexHit[]): readonly GroupEntry[] =>
  PRODUCED_KINDS.flatMap((type: AdminSearchEntityType): readonly GroupEntry[] => {
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
        extraRows: [...connectionRows(app), ...designSystemRows(app)],
        formTitles: formTitles(app),
        producedKinds: PRODUCED_KINDS,
        configKinds: CONFIG_KINDS,
      })
    }

    const hits = yield* repo.search(query)
    return { query, groups: groupHits(hits) }
  }).pipe(Effect.withSpan('admin.search-admin-global'))
