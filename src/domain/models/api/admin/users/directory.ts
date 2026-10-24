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

import { Schema } from 'effect'
import { coercedNumber } from '@/domain/models/api/combinators/coerce'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { appliedQuerySchema, searchTermSchema } from '../../combinators'
import { withDefault } from '../../combinators/schema-defaults'

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
export const adminDirectorySortFieldSchema = optionalField(
  Schema.Literals(['id', 'email', 'name', 'role', 'banned']).annotate({
    description:
      'Column to order by. Omit for the storage order. Accepts the combined `field:direction` spelling a column header emits, which the route splits before validation.',
  })
)

/** Sort direction. Default `asc` — a directory reads alphabetically. */
export const adminDirectorySortOrderSchema = Schema.Literals(['asc', 'desc'])
  .annotate({ description: 'Sort direction, applied to `sort`. Default `asc`.' })
  .pipe(withDefault('asc'))

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
export const adminUsersDirectoryQuerySchema = Schema.Struct({
  q: searchTermSchema.annotate({
    description:
      'Optional free-text search over the account `email` and `name`, as a case-insensitive literal substring. `role` and `id` are intentionally not searched. Empty / whitespace-only means "no search" (the full directory), NOT "match nothing".',
  }),
  page: coercedNumber
    .annotate({ description: '1-based page number over the matching accounts. Default 1.' })
    .pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)), withDefault(1)),
  limit: coercedNumber
    .annotate({
      description: `Accounts per page, 1-200. Default ${DEFAULT_DIRECTORY_PAGE_SIZE}, matching the grid's declared page size so the pager's arithmetic and the body agree.`,
    })
    .pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(200)
      ),
      withDefault(DEFAULT_DIRECTORY_PAGE_SIZE)
    ),
  sort: adminDirectorySortFieldSchema,
  order: adminDirectorySortOrderSchema,
  role: optionalField(
    Schema.String.annotate({
      description:
        'Only the accounts holding exactly this role, as the `role` column reads it (an account with no stored role reads the default `member`). Combines with `q`. A role nobody holds answers an empty directory, never the whole one.',
      examples: ['member'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  id: optionalField(
    Schema.String.annotate({
      description:
        'Only the account with exactly this id (`auth.user.id`): how a console page addressed by an account id reads that one account. Combines with the other filters. An id no account carries answers an empty directory, never the whole one. An id is looked up, never searched: `q` still matches only `email` and `name`.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  status: optionalField(
    Schema.Literals(['banned', 'active']).annotate({
      description:
        '`banned` keeps only the banned accounts, `active` only the others. Combines with `q` and `role`. Any other value is refused with 400.',
    })
  ),
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
export const adminDirectoryUserSchema = Schema.Struct({
  id: Schema.String.annotate({
    description:
      'Subject identifier of the account (`auth.user.id`). The id the row actions (set-role / ban-user / unban-user) target.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  email: Schema.String.annotate({
    description:
      'Account e-mail address (`auth.user.email`). The directory’s primary column and one of the two `?q=` search keys.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  name: Schema.String.annotate({
    description:
      'Account display name (`auth.user.name`). The other `?q=` search key. The column is nullable in storage; a null/absent name is coalesced to the empty string, so this is always a string (possibly empty) rather than sometimes missing — an absent key would make "this account has no name" indistinguishable from "this build does not send names".',
  }),
  role: Schema.String.annotate({
    description:
      'Account role (`auth.user.role`). The column is nullable in storage; the handler coalesces a null/empty role to the app default role, so this is always a non-empty string. The vocabulary is the APP’s configured roles, not the operator tier.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  roleLabel: Schema.String.annotate({
    description:
      'What the console shows for the account role, resolved in this order: the `label` the app declares for the role in `auth.roles` (a `$t:` key is translated into the operator\'s console language: the account language, then the language preference, then English); otherwise, for the roles every app carries, the console\'s own words (in English "Admin", "Member", "Viewer", and "Admin (read-only)" for `admin-viewer`); otherwise the name made readable, its first letter capitalised and its hyphens as spaces (`accounting-read` reads "Accounting read"). Always present. The Role column shows it. Filtering, sorting (`sort=role` orders by the role name, not by these words) and Change role keep using `role`.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  banned: Schema.Boolean.annotate({
    description:
      'Whether the account is banned (`auth.user.banned`). Drives the Statut pill: `false` → actif, `true` → banni.',
  }),
  unclaimed: optionalField(
    Schema.Boolean.annotate({
      description:
        'Whether nobody has claimed the account yet: it was created for a person the data names (a seeded account marked `unclaimed: true`, or one an import brought in) and holds no way to sign in and no pending invitation. Becomes `false` once the person sets a way to sign in. The Status column reads "Not yet claimed" for such an account rather than "Active". An invited colleague who has not yet accepted is not unclaimed.',
    })
  ),
  status: optionalField(
    Schema.Literals(['active', 'banned', 'unclaimed']).annotate({
      description:
        'The account\'s state in one word, for a column that shows one: `banned` when it is banned, else `unclaimed` when nobody has claimed it yet (see `unclaimed`), else `active`. The Status column reads it ("Active", "Banned", "Not yet claimed"); filtering and the row actions keep reading `banned`.',
    })
  ),
  createdAt: Schema.NullOr(
    Schema.String.annotate({
      description:
        'When the account was created (`auth.user.createdAt`), as an ISO 8601 instant. For an invited colleague, when the invitation created it.',
    })
  ),
  lastSignInAt: Schema.NullOr(
    Schema.String.annotate({
      description:
        'When the account last signed in, as an ISO 8601 instant: the start of its newest session, expired or not. Null when it never signed in, or when every session it held has since been signed out.',
    })
  ),
  activeSessionCount: Schema.Int.annotate({
    description:
      'How many sessions the account holds that have not expired: one per browser or device it is signed in from. A fact about its sessions, never a session — no token, address or browser string is carried.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  twoFactorEnabled: Schema.Boolean.annotate({
    description:
      'Whether the account has a second factor turned on (`auth.user.twoFactorEnabled`).',
  }),
  signInMethods: Schema.Array(Schema.String).annotate({
    description:
      'How the account signs in: the provider of each sign-in account linked to it, distinct and sorted — `credential` for an email and password, the provider id for a social or single sign-on account (`google`, `github`, …). Empty for an invited colleague who has not yet set a way to sign in.',
  }),
  signInMethodLabels: optionalField(
    Schema.Array(Schema.String).annotate({
      description:
        'The `signInMethods` as a person reads them, one per method in the same order, in the operator\'s console language: the password method in the console\'s words ("Email and password", « E-mail et mot de passe »), a provider by its brand ("Google", "GitHub", "Sovrium Cloud"). Display text only; `signInMethods` keeps the provider ids.',
    })
  ),
  groups: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        'The groups the account belongs to, by name, sorted. Empty for an account in no group, and for every account of an app that declares no group. It is what the console\'s Groups editor opens preset to. ABSENT when the memberships could not be read: an absent list is unknown, never "no group", so the editor offers no save that could clear them.',
    })
  ),
  groupLabels: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        'What the console shows for each of `groups`, in the same order: the `label` the app declares for the group in `auth.groups` (a `$t:` key is translated into the operator\'s console language: the account language, then the language preference, then English); otherwise the name made readable, its first letter capitalised and its hyphens as spaces (`equipe-a` reads "Equipe a"). Present exactly when `groups` is, and as long. The Groups column shows these chips; the Groups editor keeps using `groups`.',
    })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'AdminDirectoryUser' })

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
export const adminUsersDirectoryResponseSchema = Schema.Struct({
  users: Schema.Array(adminDirectoryUserSchema).annotate({
    description:
      'ONE PAGE of accounts from the auth `user` table — operators and app users alike — as secret-free directory rows. Narrowed to the MATCHING accounts when `?q=` is supplied, ordered by `sort`, sliced by `page`/`limit`.',
  }),
  total: Schema.Int.annotate({
    description:
      'How many accounts MATCH across every page — narrowed by `?q=`, unaffected by `page`/`limit`. The pager renders its "1-25 of N" range and decides whether a next page exists from this number, so a page that omitted it could only report the rows in front of it.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  appliedQuery: appliedQuerySchema,
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'AdminUsersDirectoryResponse',
})

// ─── Inferred types ──────────────────────────────────────────────────────────

/** @public */
export type AdminUsersDirectoryQuery = typeof adminUsersDirectoryQuerySchema.Type
/** @public */
export type AdminDirectoryUser = typeof adminDirectoryUserSchema.Type
/** @public */
export type AdminUsersDirectoryResponse = typeof adminUsersDirectoryResponseSchema.Type
