/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { App } from '@/domain/models/app'
import type { Effect } from 'effect'

/**
 * Seed Reset Repository Port
 *
 * The data a reset of the app to its seed reads and writes, besides the rows
 * the seed itself writes: the app's own tables, the system rows kept against
 * their records, what a visitor leaves behind, the accounts and their sign-in
 * material, the baselines kept accounts are returned to, the organisation, and
 * the stored files nothing names any more.
 *
 * Every write here is a raw statement, never a record program: a reset is one
 * operation on the app's own state, not a sequence of business events, so no
 * row it deletes reaches a record automation, a table webhook or the activity
 * log. The one exception is an unlisted account, removed by the engine's
 * account erasure ({@link SeedResetRepository.eraseAccount}), which writes its
 * own audit entry.
 *
 * Which system and auth tables a reset clears, rebuilds or keeps is reconciled
 * against the Drizzle schema by the implementation's coverage census, so a new
 * table holding visitor data cannot be left out without a failing test.
 */

/**
 * A reset step failed. `message` is what the step fails with, word for word —
 * it reaches the automation's run history, which an administrator reads, so
 * no message carries a baseline's values.
 */
export class SeedResetError extends Data.TaggedError('SeedResetError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** One row as the database stores it, keyed by column name. */
export type StoredRow = Readonly<Record<string, unknown>>

/** What a baseline holds: the account's user row (all but its id), and each copied table's rows. */
export interface BaselineSnapshot {
  readonly profile: StoredRow
  readonly rows: Readonly<Record<string, readonly StoredRow[]>>
}

/** A recorded baseline: the account, the address recorded with it, and the copy. */
export interface RecordedBaseline {
  readonly userId: string
  /** Lower-cased. */
  readonly email: string
  readonly snapshot: BaselineSnapshot
}

/** One account, by id and lower-cased email. */
export interface ResetAccount {
  readonly id: string
  /** Lower-cased. */
  readonly email: string
}

/** One administrator the host names, and how. */
export interface HostAdmin extends ResetAccount {
  /** Named by `AUTH_ADMIN_EMAIL`, whose `AUTH_ADMIN_PASSWORD` it signs in with. */
  readonly byEmail: boolean
}

/** The organisation a reset rebuilds: from the config and the seed, never from what a visitor left. */
export interface OrganisationRebuild {
  /** The app's name, which the organisation takes again. */
  readonly appName: string
  /** The groups the config declares: exactly the teams kept, each with no member. */
  readonly groups: readonly string[]
  /** The membership each kept account holds, by account id. */
  readonly roles: ReadonlyMap<string, 'owner' | 'member'>
  /** The host administrators, whose memberships are kept as they stand. */
  readonly adminIds: readonly string[]
}

export class SeedResetRepository extends Context.Service<
  SeedResetRepository,
  {
    /** How many rows an app table holds. */
    readonly countAppTableRows: (table: string) => Effect.Effect<number, SeedResetError>

    /**
     * Empty one app table, the link tables `junctions` names first (a link
     * table that does not exist is not an error), and answer how many rows it
     * held before.
     */
    readonly emptyAppTable: (
      table: string,
      junctions: readonly string[]
    ) => Effect.Effect<number, SeedResetError>

    /**
     * Remove every system row kept against a record of `appTables`, every
     * visitor's data, every account's small settings and the engine's caches.
     */
    readonly clearRecordScopedRows: (
      appTables: readonly string[]
    ) => Effect.Effect<void, SeedResetError>

    /** How many sessions there are. */
    readonly countSessions: Effect.Effect<number, SeedResetError>

    /**
     * End every session, unseen by any session hook: a kept account's realtime
     * connections close at the realtime layer's next liveness sweep.
     */
    readonly deleteAllSessions: Effect.Effect<void, SeedResetError>

    /** Every account, with its id and lower-cased email. */
    readonly readAccounts: Effect.Effect<readonly ResetAccount[], SeedResetError>

    /**
     * The host's administrators that exist in the database: the account
     * `AUTH_ADMIN_EMAIL` names — by a baseline recorded with that address
     * first — and the one the platform's Cloud link binds.
     */
    readonly readHostAdmins: (
      baselines: ReadonlyMap<string, RecordedBaseline>
    ) => Effect.Effect<readonly HostAdmin[], SeedResetError>

    /**
     * Remove an account through the engine's account erasure, which writes its
     * own audit entry and keeps the last account able to administer the app.
     * Answers whether it was erased.
     */
    readonly eraseAccount: (
      userId: string,
      app: Readonly<App>
    ) => Effect.Effect<boolean, SeedResetError>

    /** Set an account's name and role. */
    readonly updateAccountProfile: (
      userId: string,
      profile: { readonly name: string; readonly role: string }
    ) => Effect.Effect<void, SeedResetError>

    /** Give an account the admin role. */
    readonly setAdminRole: (userId: string) => Effect.Effect<void, SeedResetError>

    /** Set the password an account signs in with, hashed as sign-up hashes it. */
    readonly setCredentialPassword: (
      userId: string,
      password: string
    ) => Effect.Effect<void, SeedResetError>

    /**
     * Strip every account to its password and the platform administrator's
     * Cloud link, and remove the OAuth clients no account is behind and the
     * spent client assertions.
     */
    readonly clearKeptSignInMaterial: Effect.Effect<void, SeedResetError>

    /** Remove every OAuth resource no remaining client links to, but the engine's own. */
    readonly clearUnlinkedOAuthResources: Effect.Effect<void, SeedResetError>

    /** Every recorded baseline, keyed by account id. */
    readonly readBaselines: Effect.Effect<ReadonlyMap<string, RecordedBaseline>, SeedResetError>

    /** The account's live state as a baseline; none when it does not exist. */
    readonly captureBaseline: (
      userId: string
    ) => Effect.Effect<RecordedBaseline | undefined, SeedResetError>

    /**
     * The first baseline of an account kept with none: its live copy cut down
     * to its password credential and the platform administrator's Cloud link,
     * not banned, not scheduled for erasure, under the address it was kept for.
     */
    readonly captureFirstBaseline: (
      userId: string,
      keptFor: string | undefined
    ) => Effect.Effect<RecordedBaseline | undefined, SeedResetError>

    /**
     * Return accounts to their baselines in one transaction. Called with none,
     * it still removes every third-party connection token no copy holds.
     */
    readonly restoreBaselines: (
      baselines: readonly RecordedBaseline[]
    ) => Effect.Effect<void, SeedResetError>

    /**
     * Record `baselines`, replacing every one recorded before, in one
     * transaction; an account erased meanwhile is skipped. Answers what was
     * recorded.
     */
    readonly recordBaselines: (
      baselines: readonly RecordedBaseline[]
    ) => Effect.Effect<readonly RecordedBaseline[], SeedResetError>

    /** Whether the app has organisation tables at all. */
    readonly organisationExists: Effect.Effect<boolean, SeedResetError>

    /** The role each of `userIds` holds now, by account id. */
    readonly readUserRoles: (
      userIds: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, string | undefined>, SeedResetError>

    /** Rebuild the organisation in one transaction (no invitation, empty teams, fresh memberships). */
    readonly rebuildOrganisation: (
      rebuild: OrganisationRebuild
    ) => Effect.Effect<void, SeedResetError>

    /**
     * Remove every stored file the storage catalog lists that no surviving row
     * names, and answer how many.
     */
    readonly removeUnreferencedFiles: Effect.Effect<number, SeedResetError>
  }
>()('SeedResetRepository') {}
