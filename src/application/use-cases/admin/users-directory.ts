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

import { Clock, Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import {
  UsersDirectoryRepository,
  UsersDirectoryDatabaseError,
  type DirectoryUserRow,
} from '@/application/ports/repositories/tables/users-directory-repository'
import { UsersOverviewRepository } from '@/application/ports/repositories/tables/users-overview-repository'
import {
  adminUsersDirectoryResponseSchema,
  type AdminUsersDirectoryResponse,
} from '@/domain/models/api/admin/users'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { readableName } from '@/domain/models/app/auth/readable-name-service'
import { logError } from '@/infrastructure/logging/logger'
import { signInMethodLabelOf } from './sign-in-method-labels'
import type { ConsoleLabels } from '@/application/use-cases/admin/operator-language'

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
/** Without a reader's labels, both read the name made readable. */
const READABLE_LABELS: ConsoleLabels = {
  role: readableName,
  group: readableName,
  signInMethod: (id) => signInMethodLabelOf(id, 'en'),
}

/** The row's role and what the console calls it. */
const roleOf = (
  row: DirectoryUserRow,
  labels: ConsoleLabels
): { readonly role: string; readonly roleLabel: string } => {
  const role =
    typeof row.role === 'string' && row.role.length > 0 ? row.role : DEFAULT_DIRECTORY_ROLE
  return { role, roleLabel: labels.role(role) }
}

/** A dialect timestamp as an ISO 8601 instant; `null` stays `null`. */
const isoOf = (value: Readonly<Date> | string | null): string | null =>
  value === null ? null : new Date(value instanceof Date ? value.getTime() : value).toISOString()

const projectRow = (row: DirectoryUserRow, labels: ConsoleLabels): Readonly<ProjectedRow> => ({
  id: row.id,
  email: row.email,
  name: typeof row.name === 'string' ? row.name : '',
  ...roleOf(row, labels),
  banned: row.banned === true,
  createdAt: isoOf(row.createdAt),
  twoFactorEnabled: row.twoFactorEnabled === true,
  // `groups` is filled for the page alone, once it is cut (`withGroups`): one
  // read for the rows the response carries rather than for every matching
  // account.
})

/**
 * Outcome of the directory build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the schema decode error).
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
  /** Only the accounts holding exactly this role (after the default-role fill). */
  readonly role?: string | undefined
  /** `banned` keeps the banned accounts, `active` the others. */
  readonly status?: 'banned' | 'active' | undefined
  /**
   * Only the account with exactly this id: how a page addressed by an account
   * id reads its one account. Looked up, never searched — an id nobody holds
   * (an email address included) matches no row.
   */
  readonly id?: string | undefined
}

/** Whether a projected row passes the directory's role and status filters. */
const passesFilters = (row: Readonly<ProjectedRow>, input: UsersDirectoryInput): boolean =>
  (input.id === undefined || row.id === input.id) &&
  (input.role === undefined || row.role === input.role) &&
  (input.status === undefined || row.banned === (input.status === 'banned'))

/** The columns the directory can be ordered by (the closed set the API validates). */
export type DirectorySortField = 'id' | 'email' | 'name' | 'role' | 'banned'

/** One projected directory row, as the response carries it. */
type DirectoryRow = AdminUsersDirectoryResponse['users'][number]

/** A row before its session facts are read: they are read for the page alone. */
type ProjectedRow = Omit<DirectoryRow, 'lastSignInAt' | 'activeSessionCount' | 'signInMethods'>

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
  a: Readonly<ProjectedRow>,
  b: Readonly<ProjectedRow>,
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
export const orderAndPage = <Row extends ProjectedRow>(
  rows: readonly Row[],
  input: UsersDirectoryInput
): readonly Row[] => {
  const { sort, order, page, limit } = input
  const ordered = sort
    ? rows.toSorted((a, b) => (order === 'desc' ? -1 : 1) * compareOn(a, b, sort))
    : rows
  if (limit === undefined) return ordered
  const offset = ((page ?? 1) - 1) * limit
  return ordered.slice(offset, offset + limit)
}

/**
 * Attach to each row the groups its account belongs to, by name and sorted, in
 * ONE read for the whole page.
 *
 * A membership read that fails leaves `groups` ABSENT on every row rather than
 * failing the directory: the accounts are still worth showing, and the read is
 * logged. Absent, never an empty list — an empty list says "in no group", and
 * the console's Groups editor would open preset to it, so one Save would clear
 * memberships nobody could see. An app that declares no group answers empty
 * lists, because there the empty list is the truth.
 */
const withGroups = (
  rows: readonly DirectoryRow[],
  labels: ConsoleLabels
): Effect.Effect<readonly DirectoryRow[], never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const byUser = yield* repo.getUsersGroups(rows.map((row) => row.id)).pipe(
      Effect.map((read): ReadonlyMap<string, readonly string[]> | undefined => read),
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[admin] users directory: group membership read failed', cause))
      ),
      // effect-swallow: logged above; the directory still lists its accounts with their groups unknown (the key absent) rather than failing whole on the membership column.
      Effect.orElseSucceed(() => undefined)
    )
    if (byUser === undefined) return rows
    return rows.map((row) => {
      const groups = [...(byUser.get(row.id) ?? [])].toSorted((a, b) => a.localeCompare(b))
      return { ...row, groups, groupLabels: groups.map(labels.group) }
    })
  })

/**
 * Whether nobody has claimed the account, and its state in one word. Unclaimed
 * is no way to sign in and no sign-in ever (a passwordless sign-in leaves a
 * session, not a method); pending invitees never reach here, the directory
 * leaves them out.
 */
const claimOf = (
  banned: boolean,
  signInMethods: readonly string[],
  lastSignInAt: string | null
): { readonly unclaimed: boolean; readonly status: 'active' | 'banned' | 'unclaimed' } => {
  const unclaimed = signInMethods.length === 0 && lastSignInAt === null
  return { unclaimed, status: banned ? 'banned' : unclaimed ? 'unclaimed' : 'active' }
}

/**
 * Attach to each row what its sessions and sign-in accounts say — when it last
 * signed in, how many sessions it holds unexpired, and how it signs in — in ONE
 * read for the whole page. An account that never signed in reads `null`, `0`
 * and an empty list.
 */
const withAccountFacts = (
  rows: readonly ProjectedRow[],
  labels: ConsoleLabels
): Effect.Effect<readonly DirectoryRow[], UsersDirectoryDatabaseError, UsersDirectoryRepository> =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis)
    const facts = yield* (yield* UsersDirectoryRepository).readAccountFacts(
      rows.map((row) => row.id),
      now
    )
    return rows.map((row) => {
      const fact = facts.get(row.id)
      const signInMethods = [...(fact?.signInMethods ?? [])]
      const lastSignInAt = isoOf(fact?.lastSignInAt ?? null)
      return {
        ...row,
        lastSignInAt,
        activeSessionCount: fact?.activeSessionCount ?? 0,
        signInMethods,
        signInMethodLabels: signInMethods.map(labels.signInMethod ?? readableName),
        ...claimOf(row.banned, signInMethods, lastSignInAt),
      }
    })
  })

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
  input: UsersDirectoryInput = {},
  labels: ConsoleLabels = READABLE_LABELS
): Effect.Effect<
  UsersDirectoryOutcome,
  UsersDirectoryDatabaseError,
  UsersDirectoryRepository | UsersOverviewRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UsersDirectoryRepository

    const rows = yield* repo.listAllUsers(input.q !== undefined ? { q: input.q } : {})
    // An invitation creates its account before it is accepted. That account is
    // not a member yet — it is listed with the invitations, and the overview's
    // `totals.users` already leaves it out — so the directory leaves it out
    // too, and the grid counts the same people as the figure above it.
    const pending = new Set(
      yield* (yield* UsersOverviewRepository).listPendingInviteeIds.pipe(
        Effect.mapError((error) => new UsersDirectoryDatabaseError({ cause: error.cause }))
      )
    )
    const matching = rows
      .filter((row) => !pending.has(row.id))
      .map((row) => projectRow(row, labels))
      .filter((row) => passesFilters(row, input))
    const body = {
      users: [
        ...(yield* withGroups(
          yield* withAccountFacts(orderAndPage(matching, input), labels),
          labels
        )),
      ],
      total: matching.length,
      // `null`, not `undefined`: the KEY's presence is the signal (see
      // `appliedQuerySchema`). An omitted key means "this endpoint does not
      // search", which would put the grid back to filtering in memory over the
      // columns it renders — dropping every row matched on `name`.
      appliedQuery: input.q ?? null,
    } satisfies AdminUsersDirectoryResponse

    const parsed = decodeSafe(adminUsersDirectoryResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  }).pipe(Effect.withSpan('admin.build-users-directory'))
