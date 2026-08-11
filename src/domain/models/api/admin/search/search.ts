/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/search?q=` — the Native Admin Dashboard
 * GLOBAL INDEXED SEARCH.
 *
 * One admin-only endpoint that searches EVERY admin entity kind in a single
 * full-text query and returns the matches GROUPED BY TYPE so the command
 * palette can render a labelled section per kind. The seven kinds:
 *
 *   record | submission | run | user | file | conversation | connection
 *
 * ── Backing store. ─────────────────────────────────────────────────────────
 * The endpoint reads the `_admin_search_index` table
 * (`infrastructure/database/drizzle/schema/admin-search.ts` + its sqlite-core
 * mirror) — a NEW, SEPARATE index from the public record-search `search_index`.
 * Full-text is dialect-dispatched (`isSqliteRuntime()`): PostgreSQL uses a
 * `content_tsv` GIN match, SQLite uses an FTS5 virtual table — BOTH work (the
 * SQLite path does NOT degrade like the public record search).
 *
 * ── S4 hard allow-list (why every field here is secret-free). ──────────────
 * Each result is the projection of ONE index row down to a four-scalar
 * allow-list — `{ type, entityId, title, href, updatedAt }`. The raw index row
 * is NEVER spread into the response, and the schema is `.strict()`, so a stray
 * key fails the parse. Critically:
 *   - a `connection` result's `title` is the connection NAME/label ONLY —
 *     never a token, accessToken, refreshToken, or credential (mirrors the
 *     connections list allow-list, S4);
 *   - a `file` result's `title` is the file NAME ONLY;
 *   - `record` / `submission` / `user` / `run` / `conversation` results carry a
 *     human label only (the index never stores secrets in `title`/`body`).
 * The endpoint itself is admin-only: it mounts under the `/api/admin/*`
 * `requireAdminTier` catch-all, so anonymous + non-admin callers receive 404
 * (S1 anti-enumeration) — no new guard is needed.
 *
 * ── Index maintenance & the staleness tradeoff (read this). ────────────────
 * The index is populated by an ON-DEMAND / LAZY REBUILD, NOT by write-through
 * hooks on every entity mutation: when `GET /api/admin/search` is hit and the
 * index is empty or older than a freshness window (a short TTL — e.g. the index
 * carries a per-rebuild `built_at` marker and is rebuilt when it is stale), the
 * use case repopulates `_admin_search_index` from each entity's EXISTING admin
 * read paths (tables-overview record reads, the forms-submissions ledger, the
 * automations runs feed, the Better-Auth users list, the bucket file listing,
 * the agent-conversations cross-user read, the connections list) before
 * serving the query.
 *
 * STALENESS TRADEOFF (stated explicitly): a result can lag a very recent
 * mutation by up to the rebuild window — a record created 2s ago may not appear
 * until the index next rebuilds. This is the deliberate cost of keeping the
 * implementation tractable: lazy rebuild reuses read paths that already exist
 * and avoids threading a search-index writer through every entity's mutation
 * path. FULL WRITE-THROUGH HOOKS (each entity mutation incrementally upserts
 * its own index row, eliminating the lag) are a documented FUTURE ENHANCEMENT,
 * not part of this item.
 *
 * @see src/infrastructure/database/drizzle/schema/admin-search.ts (PG backing store)
 * @see src/infrastructure/database/drizzle/schema-sqlite/admin-search.ts (SQLite + FTS5)
 * @see src/domain/models/api/admin/connections/connections.ts (the S4 allow-list this mirrors)
 */

import { z } from '@hono/zod-openapi'

/**
 * The closed set of admin entity kinds the global search spans. The query
 * groups results by this discriminator; the UI renders one labelled section
 * per present kind, with a per-type badge on each result.
 */
export const adminSearchEntityTypes = [
  'record',
  'submission',
  'run',
  'user',
  'file',
  'conversation',
  'connection',
] as const

export const adminSearchEntityTypeSchema = z
  .enum(adminSearchEntityTypes)
  .describe(
    'The admin entity kind this result belongs to. Drives the per-type result group + badge.'
  )

export type AdminSearchEntityType = z.infer<typeof adminSearchEntityTypeSchema>

/**
 * A single global-search hit — the S4 allow-list projection of one
 * `_admin_search_index` row. STRICT: no extra keys, so a secret can never ride
 * along in a future field.
 */
export const adminSearchResultSchema = z
  .object({
    type: adminSearchEntityTypeSchema,
    entityId: z
      .string()
      .describe(
        'The source entity id, carried verbatim into the deep-link. Heterogeneous across kinds (record / submission / user / connection ids…).'
      ),
    title: z
      .string()
      .describe(
        'Secret-free primary label shown as the result line. Connection = NAME/label only; file = file NAME only; user = e-mail/display label; record = first text column. NEVER a token/credential (S4).'
      ),
    href: z
      .string()
      .describe(
        'The deep-link the UI navigates to when this result is selected (e.g. /_admin/tables/{name}?record={id}, /_admin/connections).'
      ),
    updatedAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 last-touch time of the source entity, used to order results (most recent first) within a type group.'
      ),
  })
  .strict()
  .describe('One admin global-search result (S4 secret-free allow-list).')

export type AdminSearchResult = z.infer<typeof adminSearchResultSchema>

/**
 * One result group — a present entity kind plus the matches for it. The
 * response is a list of these so the palette renders a labelled section per
 * kind (kinds with no match are simply absent from the list).
 */
export const adminSearchGroupSchema = z
  .object({
    type: adminSearchEntityTypeSchema,
    results: z
      .array(adminSearchResultSchema)
      .describe('Matches for this entity kind, most-recent first (capped per group).'),
  })
  .strict()
  .describe('A per-type group of global-search results.')

export type AdminSearchGroup = z.infer<typeof adminSearchGroupSchema>

/**
 * The `GET /api/admin/search?q=` response body: grouped cross-entity results.
 *
 * `query` echoes back the (trimmed) search term the index was queried with.
 * `groups` is the per-type sections, in the canonical kind order
 * ({@link adminSearchEntityTypes}); a kind with no match is omitted. An empty
 * `groups` array is the canonical NO-RESULTS body (a 200, not a 404).
 */
export const adminSearchResponseSchema = z
  .object({
    query: z.string().describe('The trimmed query term the index was searched with.'),
    groups: z
      .array(adminSearchGroupSchema)
      .describe(
        'Per-type result sections in canonical kind order. Empty array = no results (still a 200).'
      ),
  })
  .strict()
  .describe('Admin global-search response — cross-entity results grouped by kind.')

export type AdminSearchResponse = z.infer<typeof adminSearchResponseSchema>
