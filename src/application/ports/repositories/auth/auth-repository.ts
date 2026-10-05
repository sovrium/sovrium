/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for auth operations (users table)
 */
export class AuthDatabaseError extends Data.TaggedError('AuthDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * The two per-account operator-email preferences stored on `auth.user`.
 */
export type NotificationPreference = 'automationAlerts' | 'weeklyDigest'

/** The two ban columns of an account, as the last-admin rail reads and restores them. */
export type UserBanState = {
  readonly banned: boolean
  readonly banReason: string | null
}

/**
 * Auth Repository Port
 *
 * Provides type-safe database operations for authentication-related
 * user management (email verification, role lookup, role updates).
 * Methods operate on the Better Auth `users` and `sessions` tables.
 *
 * Implementation lives in infrastructure layer (auth-repository-live.ts).
 */
export class AuthRepository extends Context.Service<
  AuthRepository,
  {
    readonly verifyUserEmail: (userId: string) => Effect.Effect<void, AuthDatabaseError>
    /**
     * Resolve a user's email by id from the Better Auth `user` table. Resolves
     * `undefined` when no such user exists. Used for AI-chat activity-log
     * attribution.
     */
    readonly findUserEmailById: (
      userId: string
    ) => Effect.Effect<string | undefined, AuthDatabaseError>
    /**
     * The email of each of `userIds`, in one query, keyed by user id. An id no
     * account holds, or whose account has no address, is absent from the map.
     */
    readonly findUserEmailsByIds: (
      userIds: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, string>, AuthDatabaseError>
    /**
     * A user's display name and email, by id, or `undefined` when no such user
     * exists. `name` is the account's own display name and may be empty; the
     * caller decides what to show in its place. Used by the pause and resume
     * notices, which name the operator who acted and leave them off the list.
     */
    /**
     * The account that holds each address, keyed by the address lowercased —
     * an address no account holds is absent from the map. Case is ignored, as
     * sign-in ignores it. Used to pin an approval request's approvers named by
     * email to the accounts that held those addresses when it was made.
     */
    readonly findUserIdsByEmails: (
      emails: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, string>, AuthDatabaseError>
    readonly findUserContactById: (
      userId: string
    ) => Effect.Effect<
      { readonly name: string; readonly email: string } | undefined,
      AuthDatabaseError
    >
    readonly getUserRole: (userId: string) => Effect.Effect<string | undefined, AuthDatabaseError>
    /**
     * Resolve the roles of MANY users in ONE query, keyed by user id.
     *
     * The bulk form of {@link getUserRole}, and it exists for a resource bound
     * rather than for convenience: a caller that classifies a LIST of users —
     * the connected-users roster, an admin roster filter — otherwise issues one
     * pooled read per row, so a page of rows is a fan-out as wide as the page
     * against a ten-connection pool. That is the mechanism of the 2026-07-25
     * production 504; see
     * `[internal ref]`.
     *
     * Ids absent from the `user` table, and rows whose `role` column is NULL,
     * are ABSENT from the returned map — it is not padded with a default.
     * Callers own the default exactly as they do for `getUserRole`'s
     * `undefined`, so the two forms cannot drift on what "no role" means.
     *
     * An empty `userIds` resolves to an empty map WITHOUT touching the
     * database: the answer is knowable without asking, and `inArray(col, [])`
     * is a shape worth not relying on across two dialects.
     */
    readonly getUserRoles: (
      userIds: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, string>, AuthDatabaseError>
    /**
     * The label a read surface prints for each of MANY accounts, in ONE query:
     * the account's name, or its email when it has none.
     *
     * The bulk read behind the `_display` label of a `user` / `created-by` /
     * `updated-by` / `deleted-by` field. One `IN (...)` per page of records,
     * never one read per row — a page of rows fanned out per id is the shape
     * `[internal ref]` forbids.
     *
     * Ids that name no account are ABSENT from the map, so the caller keeps
     * printing the stored id for them. An empty `userIds` answers an empty map
     * without touching the database.
     */
    readonly getUserDisplayLabels: (
      userIds: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, string>, AuthDatabaseError>
    /**
     * The accounts a `user` picker offers, each labelled by its name — or, for
     * an account with none, by its email with the mailbox masked, since the
     * directory reaches every signed-in visitor — ordered by that label, at
     * most `limit` of them, in ONE query.
     *
     * Only `id`, `name` and `email` are read; nothing else of an account
     * leaves the table.
     */
    readonly listAccountChoices: (
      limit: number
    ) => Effect.Effect<
      ReadonlyArray<{ readonly id: string; readonly label: string }>,
      AuthDatabaseError
    >
    readonly updateUserRole: (
      userId: string,
      role: string
    ) => Effect.Effect<void, AuthDatabaseError>
    /**
     * Whether a row exists in the Better Auth `user` table for `userId`.
     *
     * A pure existence probe — it deliberately does NOT project any column, so
     * callers cannot accidentally depend on a user's email/role being non-empty
     * as a proxy for existence. Used by the `auth/*` automation action handlers
     * to reject an unknown `userId` before attempting a mutation.
     */
    readonly userExists: (userId: string) => Effect.Effect<boolean, AuthDatabaseError>
    /**
     * Whether `userId` names an account that may still act: it exists and is
     * not banned (a ban whose expiry has passed no longer counts). A run
     * started by hand acts as its starter only while this holds — an account
     * deleted or banned since loses the standing its run was started with.
     */
    readonly isActiveUser: (userId: string) => Effect.Effect<boolean, AuthDatabaseError>
    /**
     * This user's role, distinguishing "no such user" from "user with no role".
     *
     * {@link getUserRole} conflates them — both answer `undefined` — which is
     * harmless where the caller defaults a missing role, and NOT harmless where
     * the absence of a row must REJECT. The MCP bearer bridge is the second
     * case: falling through to the `member` default for an unidentifiable
     * subject would promote it to a writing role and widen the tool surface,
     * with nothing in the response revealing it.
     *
     * So: `undefined` means no row; `{ role: null }` means a row whose `role`
     * column is NULL. The two are different answers and callers that care can
     * tell them apart without a second query.
     */
    readonly findUserRole: (
      userId: string
    ) => Effect.Effect<{ readonly role: string | null } | undefined, AuthDatabaseError>
    /**
     * Ban a user account: sets `banned = true`, and `ban_reason` only when a
     * reason is supplied (an absent reason leaves the column untouched, matching
     * Better Auth's optional ban-reason semantics).
     */
    readonly banUser: (userId: string, reason?: string) => Effect.Effect<void, AuthDatabaseError>
    /**
     * Re-enable a previously banned account — the inverse of {@link banUser}.
     * Writes an explicit `banned = false` (rather than null) so the column
     * reflects an intentional reinstatement, and an explicit `ban_reason = NULL`
     * so a stale reason is not left behind.
     */
    readonly unbanUser: (userId: string) => Effect.Effect<void, AuthDatabaseError>
    /**
     * The ban columns of one account, or `undefined` when no row matches.
     * `banned` is `true` only for a stored `true` — NULL and `false` are both
     * "not banned", the rule {@link countActiveAdmins} applies — so a ban an
     * automation is about to write can be told apart from one already there.
     */
    readonly findUserBanState: (
      userId: string
    ) => Effect.Effect<UserBanState | undefined, AuthDatabaseError>
    /**
     * Write back ban columns read by {@link findUserBanState}, verbatim. Used to
     * undo a ban that left no admin able to sign in.
     */
    readonly restoreUserBanState: (
      userId: string,
      state: UserBanState
    ) => Effect.Effect<void, AuthDatabaseError>
    /**
     * Resolve the names of every group the given user belongs to (un-prefixed,
     * NOT `group:`-prefixed).
     *
     * Sovrium "groups" (`app.auth.groups[]`) are materialised as Better Auth
     * "teams" inside the single per-app organization, so a user belongs to a
     * group when a `team_member` row links their `user.id` to the group's
     * `team.id`. Table permissions reference these with the `group:<name>`
     * prefix and evaluate most-permissive-wins.
     *
     * Returns an empty array when the user belongs to no groups. Fails with
     * `AuthDatabaseError` when the team tables are absent (auth not configured)
     * — callers that treat "no auth" as "no memberships" must catch it.
     */
    readonly getUserGroups: (userId: string) => Effect.Effect<readonly string[], AuthDatabaseError>
    /**
     * {@link getUserGroups} for MANY users in ONE query: each user's group
     * names (un-prefixed). A user in no group is absent from the map, and an
     * empty `userIds` answers an empty map without a query. Fails as
     * `getUserGroups` does when the team tables are absent.
     */
    readonly getUsersGroups: (
      userIds: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, readonly string[]>, AuthDatabaseError>
    /**
     * Count rows in the Better Auth `user` table. Counts EVERY row, including
     * synthetic agent service users (`type='agent'`), so it is NOT a reliable
     * "has a human admin been provisioned?" signal — prefer
     * {@link countHumanUsers} for the admin-bootstrap preconditions.
     *
     * Returns 0 when the table is empty. Implementations MUST fail with
     * `AuthDatabaseError` only for genuine DB errors (connection lost,
     * table missing under a partial migration).
     */
    readonly countUsers: Effect.Effect<number, AuthDatabaseError>
    /**
     * Count only HUMAN (sign-in-capable) users — those backed by at least one
     * `auth.account` row. AI agents declared in `app.agents[]` are mirrored
     * into `auth.user` as synthetic service identities (`type='agent'`) that
     * carry NO `auth.account` row and cannot sign in; counting them in the
     * admin-bootstrap preconditions wrongly makes the env-var admin bootstrap
     * (and the no-config bootstrap-token flow) no-op for any app that declares
     * agents. This account-existence test is the dialect-portable discriminator
     * (it does not depend on the lazily-added `type` column) used to decide
     * "has a real admin already been provisioned?".
     *
     * Returns 0 when no sign-in-capable user exists. Implementations MUST fail
     * with `AuthDatabaseError` only for genuine DB errors.
     */
    readonly countHumanUsers: Effect.Effect<number, AuthDatabaseError>
    /**
     * Find the first (lowest-`id`) user holding the app's admin-equivalent
     * role in the Better Auth `user` table. Returns `undefined` when no such
     * admin exists yet (no users at all, or users exist but none hold the
     * admin role).
     *
     * `adminRole` is the configured admin-equivalent role resolved via
     * `resolveAdminRole(app)` — built-in `'admin'` for default apps, or the
     * highest-`level` custom role (e.g. cloud `operator`, partner `engineer`)
     * for custom-role apps (WI-5). Callers MUST pass it; there is no default
     * so the literal `'admin'` is never silently assumed for a custom-role app.
     *
     * Used by the startup banner's admin phase to render
     * a `✓ Admin: <email>` success line. Ordering by `id` keeps the displayed
     * admin stable across reboots when multiple admins exist.
     */
    readonly findFirstAdmin: (
      adminRole: string
    ) => Effect.Effect<{ readonly email: string } | undefined, AuthDatabaseError>
    /**
     * Count the users who currently hold ANY of `adminRoles` AND are not
     * banned. Used by the last-admin lockout guard on the admin role-mutation
     * endpoints.
     *
     * `adminRoles` is the set of role names that can actually reach
     * `/api/auth/admin/*` — the app's `resolveAdminRole(app)` plus the literal
     * `'admin'` when they differ. It is deliberately NARROWER than
     * `isAdminTier`: a dashboard-tier role such as `admin-viewer` is 404ed by
     * `applyAdminRoleCheckMiddleware`, so counting it would report a door open
     * that is in fact locked.
     *
     * The gap this note previously described — `applyAdminRoleCheckMiddleware`
     * gating on the LITERAL `role === 'admin'` while this count followed
     * `resolveAdminRole` — is CLOSED: that middleware now gates on
     * `isAdminEquivalent`, of which `adminRoleNamesFor` is the list form: the
     * app's highest role, and the built-in `admin` always — so door and count
     * agree exactly, including in an app whose custom role outranks `admin`.
     * Note that this rail is explicitly NOT a security boundary (see
     * `admin-role-guards.ts`) — both actors are already admins.
     *
     * BANNED USERS ARE EXCLUDED. A banned admin still carries `role='admin'`
     * but cannot sign in, so counting it would permit exactly the lockout the
     * guard exists to prevent (ban the other admin, then demote yourself).
     * Implementations MUST treat a NULL `banned` column as not-banned.
     *
     * Returns 0 when no active admin exists.
     */
    readonly countActiveAdmins: (
      adminRoles: readonly string[]
    ) => Effect.Effect<number, AuthDatabaseError>
    /**
     * The email of every account that should receive one kind of operator email:
     * holding ANY of `roles`, not banned, and with the named preference still on.
     *
     * `preference` names one of the two engine-owned `auth.user` columns —
     * `automationAlerts` is `notify_automation_alerts`, `weeklyDigest` is
     * `notify_weekly_digest` — both `NOT NULL DEFAULT true`, so an account that
     * never touched its profile is included. Banned accounts are excluded with
     * the same NULL-as-not-banned rule {@link countActiveAdmins} applies: a
     * banned admin cannot sign in to act on the email.
     *
     * An empty `roles` resolves to an empty list WITHOUT touching the database.
     * Rows with an empty email are skipped.
     */
    readonly findNotificationRecipients: (input: {
      readonly roles: readonly string[]
      readonly preference: NotificationPreference
    }) => Effect.Effect<readonly string[], AuthDatabaseError>
  }
>()('AuthRepository') {}
