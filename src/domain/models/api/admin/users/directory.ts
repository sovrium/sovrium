/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/users` — the Data-tab **Utilisateurs**
 * account directory.
 *
 * WHY THIS ENDPOINT EXISTS (the bug it fixes)
 * -------------------------------------------
 * The directory island (`admin-users-directory`) originally fetched Better
 * Auth's `GET /api/auth/admin/list-users` to populate the table. That endpoint
 * is gated by the Better Auth admin plugin on the role being **exactly**
 * `admin` (`adminRoles: ['admin']`). An app whose top operator role is a CUSTOM
 * role — e.g. the partner app's `engineer` (level 80) — therefore got a **404**
 * from `list-users`, so the directory rendered NOBODY even though the operator
 * is fully admin-tier in Sovrium's own model.
 *
 * The sibling KPI read `GET /api/admin/users/overview` already proved the
 * decoupled posture: it is gated by Sovrium's `requireAdminTier`
 * (`resolveDashboardTier`, which resolves a custom top role to `admin-editor`)
 * and reads the auth `user` table DIRECTLY, so it returns 200 for the same
 * `engineer` operator. This endpoint mirrors that posture for the row data:
 *
 *   - gated by `requireAdminTier` (custom-role-aware, NOT the Better Auth
 *     literal-`admin` gate), so EVERY admin-tier operator reaches it —
 *     including a custom top role;
 *   - reads the auth `user` table directly via the dialect-aware
 *     `authUsersTable()` selector (PG `auth.user` / SQLite `auth_user`);
 *   - returns the secret-free subset the directory table renders.
 *
 * Source story: [internal ref]
 *
 * @see src/presentation/api/routes/admin/users-overview.ts — the sibling
 *   admin-tier endpoint reading the auth `user` table directly (the pattern).
 * @see src/infrastructure/database/repositories/tables/users-overview-repository-live.ts
 *   — the dialect-aware `authUsersTable()` read pattern the directory repository mirrors.
 * @see src/presentation/islands/admin/users/admin-users-directory-data.ts —
 *   `loadDirectory()`, repointed from `/api/auth/admin/list-users` to this endpoint.
 * @see src/domain/models/api/admin/connections/connections.ts — the flat
 *   `{ <items> }` admin-list-response precedent this mirrors.
 */

import { z } from '@hono/zod-openapi'
import { appliedQuerySchema, searchTermSchema } from '../../_shared'

// ─── Directory Query ─────────────────────────────────────────────────────────

/**
 * The page size the grid declares, and therefore the endpoint's default. Kept
 * as one constant so the two cannot drift: a pager computing its ranges from 25
 * over a body of some other size is arithmetic the operator cannot check.
 */
export const DEFAULT_DIRECTORY_PAGE_SIZE = 25

/**
 * The columns the directory can order by — exactly the ones it renders, plus
 * the row identity.
 *
 * A closed set rather than a pass-through. Accepting any key and quietly
 * ignoring the ones that cannot be served answers 200 with rows in whatever
 * order the scan yielded, under a header painting a sort arrow — and the
 * operator believes the arrow. An unsupported key is a 400.
 */
export const adminDirectorySortFieldSchema = z
  .enum(['id', 'email', 'name', 'role', 'banned'])
  .optional()
  .describe(
    'Column to order by. Omit for the storage order. Accepts the combined `field:direction` spelling a column header emits, which the route splits before validation.'
  )

/** Sort direction. Default `asc` — a directory reads alphabetically. */
export const adminDirectorySortOrderSchema = z
  .enum(['asc', 'desc'])
  .default('asc')
  .describe('Sort direction, applied to `sort`. Default `asc`.')

/**
 * Query schema for `GET /api/admin/users`.
 *
 * The directory's FIRST query surface — the endpoint previously parsed nothing
 * at all, which is precisely how `?q=` came to be accepted and discarded.
 *
 * ## What `q` searches, and why `name` is the point
 *
 * `email` and `name`, as a case-insensitive substring.
 *
 * `name` is the reason this endpoint needed fixing, and its defect is not a
 * volume problem — it reproduces with three accounts. The directory projected
 * only `{ id, email, role, banned }`, so an account's name never left the
 * server. No client-side filter could match it and no server-side search
 * existed, which means an operator searching for a colleague by the name they
 * know them by got a confident **"No user matches"** for an account sitting in
 * the table. Searching a person by their name is the most ordinary thing an
 * operator does with a user directory.
 *
 * `name` is therefore BOTH searched and RETURNED (see {@link adminDirectoryUserSchema}).
 * Making it searchable without returning it would trade one lie for a quieter
 * one: the row would come back with nothing on it explaining why it matched. A
 * field the operator can search on is a field they should be able to read.
 *
 * `role` is deliberately NOT searched. It is a closed vocabulary rendered as a
 * pill, not free text: typing `admin` would return every administrator rather
 * than the person the operator meant, and a role is the kind of field that wants
 * an exact filter rather than a substring match. `id` is not searched either —
 * an opaque identifier is looked up, not searched for.
 *
 * ## Pagination, sorting and export
 *
 * `page` / `limit` slice the matching set, `sort` orders it, and `format=csv`
 * downloads it. The grid was ALREADY sending all three — its pager, its column
 * headers and its Export button emit `?page=`, `?limit=`, `?sort=field:direction`
 * and `?format=csv` — and the endpoint parsed none of them. Hono drops an
 * unrecognised query parameter silently, so every one of those controls got a
 * confident 200 carrying the same unsliced, unsorted JSON: a pager that read
 * "1-25 of 33" over 33 painted rows, a sort arrow over an unchanged list, and an
 * Export button that navigated the operator out of the console to raw JSON.
 *
 * The offset spelling (rather than the cursor envelope the high-volume
 * agents/buckets endpoints use) matches what the grid can actually drive: it
 * has a page number and no cursor. The account population of one self-hosted
 * app stays small enough for that to be the right trade.
 */
export const adminUsersDirectoryQuerySchema = z.object({
  q: searchTermSchema.describe(
    'Optional free-text search over the account `email` and `name`, as a case-insensitive literal substring. `role` and `id` are intentionally not searched. Empty / whitespace-only means "no search" (the full directory), NOT "match nothing".'
  ),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('1-based page number over the matching accounts. Default 1.'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(DEFAULT_DIRECTORY_PAGE_SIZE)
    .describe(
      `Accounts per page, 1-200. Default ${DEFAULT_DIRECTORY_PAGE_SIZE}, matching the grid's declared page size so the pager's arithmetic and the body agree.`
    ),
  sort: adminDirectorySortFieldSchema,
  order: adminDirectorySortOrderSchema,
})

// ─── Directory User Row ──────────────────────────────────────────────────────

/**
 * A single account row in the directory — the secret-free subset the
 * `EndUserRow` table renders. Flat projection of one `auth.user` row.
 *
 * `.strict()` is the SECURITY INVARIANT: any extra key — especially anything
 * credential-shaped (`password`, `banReason`) — fails validation rather than
 * leaking. The exposed set is EXACTLY what the table needs:
 *   - `id`     — the subject id the row actions (set-role / ban / unban) target;
 *   - `email`  — the account's address (the table's primary column + search key);
 *   - `name`   — the account's display name. Present so that a name the operator
 *     can SEARCH is also a name they can READ: a row returned because its name
 *     matched, on a table that never shows the name, matches for an invisible
 *     reason. `auth.user.name` is nullable in storage; the handler coalesces a
 *     null name to the empty string, the same treatment `role` gets;
 *   - `role`   — the account's role pill. `auth.user.role` is nullable; the
 *     handler coalesces a null/empty role to the app's default role string
 *     before emitting, so this field is always a non-empty string here;
 *   - `banned` — the account's ban state, driving the Statut pill (actif / banni).
 *
 * Listing EVERY account (operators AND app users alike) is the directory's
 * "Customers"-model contract — the operator has one console for the whole user
 * population — so the signed-in operator's own row is always present.
 */
export const adminDirectoryUserSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Subject identifier of the account (`auth.user.id`). The id the row actions (set-role / ban-user / unban-user) target.'
      ),
    email: z
      .string()
      .min(1)
      .describe(
        'Account e-mail address (`auth.user.email`). The directory’s primary column and one of the two `?q=` search keys.'
      ),
    name: z
      .string()
      .describe(
        'Account display name (`auth.user.name`). The other `?q=` search key. The column is nullable in storage; a null/absent name is coalesced to the empty string, so this is always a string (possibly empty) rather than sometimes missing — an absent key would make "this account has no name" indistinguishable from "this build does not send names".'
      ),
    role: z
      .string()
      .min(1)
      .describe(
        'Account role (`auth.user.role`). The column is nullable in storage; the handler coalesces a null/empty role to the app default role, so this is always a non-empty string. The vocabulary is the APP’s configured roles, not the operator tier.'
      ),
    banned: z
      .boolean()
      .describe(
        'Whether the account is banned (`auth.user.banned`). Drives the Statut pill: `false` → actif, `true` → banni.'
      ),
  })
  .strict()
  .openapi('AdminDirectoryUser')

// ─── Directory List Response ─────────────────────────────────────────────────

/**
 * Response schema for `GET /api/admin/users`.
 *
 * `{ users, total, appliedQuery }` — ONE page of accounts plus how many match in
 * all. A flat offset page rather than the cursor envelope the high-volume
 * agents/buckets endpoints use, because the grid driving it has a page number
 * and no cursor. `.strict()` so a stray top-level key cannot smuggle a secret
 * past the boundary.
 *
 * `total` is what makes the pager honest, and it is REQUIRED rather than
 * optional for that reason: a page carrying rows but no count leaves the grid
 * to guess how many pages exist, and it guessed by counting the rows it had —
 * which is how a directory of 33 accounts came to report "1-25 of 25" with the
 * Next button disabled over the eight it was hiding.
 *
 * An app with no accounts beyond the bootstrap operator still returns that one
 * operator row (the directory lists the whole population); a truly empty
 * `users: []` is what the island's calm empty state renders.
 */
export const adminUsersDirectoryResponseSchema = z
  .object({
    users: z
      .array(adminDirectoryUserSchema)
      .describe(
        'ONE PAGE of accounts from the auth `user` table — operators and app users alike — as secret-free directory rows. Narrowed to the MATCHING accounts when `?q=` is supplied, ordered by `sort`, sliced by `page`/`limit`.'
      ),
    total: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'How many accounts MATCH across every page — narrowed by `?q=`, unaffected by `page`/`limit`. The pager renders its "1-25 of N" range and decides whether a next page exists from this number, so a page that omitted it could only report the rows in front of it.'
      ),
    appliedQuery: appliedQuerySchema,
  })
  .strict()
  .openapi('AdminUsersDirectoryResponse')

// ─── Inferred types ──────────────────────────────────────────────────────────

/** @public */
export type AdminUsersDirectoryQuery = z.infer<typeof adminUsersDirectoryQuerySchema>
/** @public */
export type AdminDirectoryUser = z.infer<typeof adminDirectoryUserSchema>
/** @public */
export type AdminUsersDirectoryResponse = z.infer<typeof adminUsersDirectoryResponseSchema>
