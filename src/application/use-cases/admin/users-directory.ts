/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use case for the admin Data-tab **Utilisateurs** account directory
 * (`GET /api/admin/users`).
 *
 * The application layer owns the pure projection:
 *   - reading every `auth.user` row via {@link UsersDirectoryRepository},
 *   - coalescing a null / empty `role` to the app default role
 *     (`DEFAULT_DIRECTORY_ROLE`) so the response schema's non-empty-role
 *     invariant always holds — WITHOUT collapsing the app's role vocabulary
 *     (a custom top role like `engineer` is preserved verbatim, unlike the
 *     overview tile which buckets into admin/operator/member),
 *   - coercing the nullable `banned` flag to a strict boolean,
 *   - assembling + response-schema-validating the `{ users }` body.
 *
 * Only the single raw read lives in the infrastructure repository. Unlike the
 * sibling overview endpoint, the directory read has NO fitting audit-catalog
 * action (`user.overview.queried` is overview-specific), so the route emits no
 * audit entry — see the route handler note.
 */

import { Effect, Layer } from 'effect'
import {
  UsersDirectoryRepository,
  type UsersDirectoryDatabaseError,
  type DirectoryUserRow,
} from '@/application/ports/repositories/tables/users-directory-repository'
import {
  adminUsersDirectoryResponseSchema,
  type AdminUsersDirectoryResponse,
} from '@/domain/models/api/admin/users'
import { UsersDirectoryRepositoryLive } from '@/infrastructure/database/repositories/tables/users-directory-repository-live'

/**
 * The fallback role for an account whose `auth.user.role` column is NULL or
 * empty. Mirrors the platform default registration role (auth `defaultRole`
 * defaults to `member`) and the directory island's existing client-side
 * `?? 'member'` fallback. An account with a real role (including a custom top
 * role like `engineer`) keeps its own role string — this only fills the gap so
 * the response schema's `role.min(1)` invariant always holds.
 */
const DEFAULT_DIRECTORY_ROLE = 'member'

/**
 * Project one raw `auth.user` row into a secret-free directory row: keep
 * `id` / `email` verbatim, coalesce a null `name` to the empty string, coalesce
 * a null / empty `role` to the app default, and coerce the nullable `banned`
 * flag to a strict boolean.
 *
 * `name` is coalesced rather than omitted so "this account has no name" stays
 * distinguishable from "this build does not send names" — an absent key would
 * make the two identical to every reader of the response.
 */
const projectRow = (
  row: DirectoryUserRow
): Readonly<AdminUsersDirectoryResponse['users'][number]> => ({
  id: row.id,
  email: row.email,
  name: typeof row.name === 'string' ? row.name : '',
  role: typeof row.role === 'string' && row.role.length > 0 ? row.role : DEFAULT_DIRECTORY_ROLE,
  banned: row.banned === true,
})

/**
 * Outcome of the directory build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the Zod error).
 */
export type UsersDirectoryOutcome =
  | { readonly _tag: 'Ok'; readonly body: AdminUsersDirectoryResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * The read parameters for one directory build. `q` is the operator's free-text
 * term, already trimmed and length-validated by `searchTermSchema` at the route
 * boundary — `undefined` means "no search" (the whole directory).
 *
 * `sort` / `order` / `page` / `limit` are validated at the same boundary, so an
 * unsupported sort column never reaches here. An ABSENT `limit` means "no
 * slice": the export path wants every matching account, not the page the grid
 * happens to be looking at.
 */
export interface UsersDirectoryInput {
  readonly q?: string | undefined
  readonly sort?: DirectorySortField | undefined
  readonly order?: 'asc' | 'desc' | undefined
  readonly page?: number | undefined
  readonly limit?: number | undefined
}

/** The columns the directory can be ordered by (the closed set the API validates). */
export type DirectorySortField = 'id' | 'email' | 'name' | 'role' | 'banned'

/** One projected directory row, as the response carries it. */
type DirectoryRow = AdminUsersDirectoryResponse['users'][number]

/**
 * Compare two rows on one column.
 *
 * Plain relational comparison on the string columns, NOT `localeCompare`: the
 * operator's mental model of "sorted by email" is the same code-point order
 * their tooling and their own `sort` produce, and a locale-aware collation
 * would silently disagree with it for exactly the addresses that mix
 * punctuation with letters. `banned` sorts false-before-true.
 */
const compareOn = (
  a: Readonly<DirectoryRow>,
  b: Readonly<DirectoryRow>,
  field: DirectorySortField
): number => {
  if (field === 'banned') return Number(a.banned) - Number(b.banned)
  const left = a[field]
  const right = b[field]
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Order the matching rows, then cut out the requested page.
 *
 * Both happen HERE rather than in SQL because the repository deliberately reads
 * the whole (small) account population in one scan; keeping the ordering beside
 * the slice is what guarantees page 2 is the rows that follow page 1 rather
 * than a second sample of an unordered set.
 *
 * An absent `limit` returns everything, which is what the CSV export needs.
 */
export const orderAndPage = (
  rows: readonly DirectoryRow[],
  input: UsersDirectoryInput
): readonly DirectoryRow[] => {
  const { sort, order, page, limit } = input
  const ordered = sort
    ? rows.toSorted((a, b) => (order === 'desc' ? -1 : 1) * compareOn(a, b, sort))
    : rows
  if (limit === undefined) return ordered
  const offset = ((page ?? 1) - 1) * limit
  return ordered.slice(offset, offset + limit)
}

/**
 * Build the `{ users, total, appliedQuery }` directory body — one ordered page
 * of the matching `auth.user` accounts, projected to the secret-free rows the
 * directory table renders, response-schema-validated.
 *
 * `total` counts the MATCHING accounts, not the page: the pager derives both its
 * range and whether a next page exists from it, so a count of the rows in hand
 * would make the pager describe itself instead of the directory.
 *
 * `appliedQuery` rides EVERY response, `null` when no term was applied. Its
 * PRESENCE is what tells the grid the narrowing already happened and must not be
 * repeated over the columns it renders — the failure that hid an account matched
 * on `name` while `name` was not a column. `null` rather than omission keeps
 * "does this endpoint search server-side" answerable without sending a term.
 *
 * Returns `Ok` with the validated body or `ValidationFailed` when the assembled
 * body does not match `adminUsersDirectoryResponseSchema`.
 */
export const BuildUsersDirectory = (
  input: UsersDirectoryInput = {}
): Effect.Effect<UsersDirectoryOutcome, UsersDirectoryDatabaseError, UsersDirectoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* UsersDirectoryRepository

    const rows = yield* repo.listAllUsers(input.q !== undefined ? { q: input.q } : {})
    const matching = rows.map(projectRow)
    const body = {
      users: [...orderAndPage(matching, input)],
      total: matching.length,
      // `null`, not `undefined`: the KEY's presence is the signal (see
      // `appliedQuerySchema`). An omitted key means "this endpoint does not
      // search", which would put the grid back to filtering in memory over the
      // columns it renders — dropping every row matched on `name`.
      // eslint-disable-next-line unicorn/no-null -- the API envelope canonically distinguishes an explicit `null` ("no term applied") from an ABSENT key ("endpoint does not search"); `undefined` erases that distinction on the wire
      appliedQuery: input.q ?? null,
    } satisfies AdminUsersDirectoryResponse

    const parsed = adminUsersDirectoryResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })

/**
 * Application layer for the users-directory use case.
 */
export const UsersDirectoryLayer = Layer.mergeAll(UsersDirectoryRepositoryLive)
