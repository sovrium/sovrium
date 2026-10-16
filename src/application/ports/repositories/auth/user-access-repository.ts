/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect, Option } from 'effect'

/**
 * Database error for user_access junction operations.
 *
 * Z-2 multi-tenant junction is created at startup by `schema-initializer.ts`
 * whenever `auth.scopeTables` is configured. Errors at this layer typically
 * indicate either a missing relation (apps that don't declare scopeTables)
 * or a constraint violation.
 */
export class UserAccessDatabaseError extends Data.TaggedError('UserAccessDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Persisted user_access row shape returned by repository reads/writes.
 */
export interface UserAccessRow {
  readonly id: string
  readonly userId: string
  readonly tableSlug: string
  readonly recordIds: readonly string[]
  readonly role: string
  readonly createdAt: Readonly<Date>
  readonly createdBy: string | undefined
}

/**
 * Input shape for the canonical insert call. Audit fields (`createdAt`,
 * `id`) are populated by the database layer (DEFAULT NOW(), gen_random_uuid()).
 */
export interface UserAccessInsertInput {
  readonly userId: string
  readonly tableSlug: string
  readonly recordIds: readonly string[]
  readonly role: string
}

/**
 * A change to one grant: its records, its role, or both. A grant keeps its
 * account and its table — moving access elsewhere is a revocation and a new
 * grant.
 */
export interface UserAccessChange {
  readonly recordIds?: readonly string[]
  readonly role?: string
}

/** One record of a scope table, granted to (or taken from) one account. */
export interface UserAccessRecordGrant {
  readonly userId: string
  readonly tableSlug: string
  readonly recordId: string
}

/**
 * Which grants a listing returns: every one, or those matching each criterion
 * given — an account's (by id, or by email address matched without regard to
 * case), a table's, the ones naming one record of it.
 */
export interface UserAccessFilter {
  readonly userId?: string
  readonly userEmail?: string
  readonly tableSlug?: string
  readonly recordId?: string
}

/** An account a grant names, as a listing reads it back to an admin. */
export interface UserAccessAccount {
  readonly id: string
  readonly email: string
  readonly name: string
}

/**
 * Where a scope table's records take their readable label from: the table, the
 * column its records are keyed by, and the column holding the label.
 */
export interface RecordLabelSource {
  readonly tableName: string
  readonly primaryKey: string
  readonly labelField: string
}

/** One record's readable label. */
export interface RecordLabel {
  readonly id: string
  readonly label: string
}

/**
 * User-Access Repository Port (Z-2).
 *
 * Backs the `user_access` junction table that maps users to record-id
 * lists per scope-table + role. The DDL is engine-managed (created at
 * startup when `auth.scopeTables` is configured) and thus operates on a
 * fixed shape rather than user-defined schemas — so the port models a
 * narrow set of read/write operations rather than a generic CRUD surface.
 *
 * Migrated from raw `bun:sql` access in user-access-handlers.ts (R-1
 * audit) to bring the user_access surface in line with the rest of the
 * presentation layer, which always passes through an Effect Layer.
 */
export class UserAccessRepository extends Context.Service<
  UserAccessRepository,
  {
    /**
     * Insert a new user_access row, populating `created_by` with the
     * supplied actor. Returns the persisted row so the route handler can
     * echo back the canonical record envelope.
     */
    readonly insert: (
      input: Readonly<UserAccessInsertInput>,
      createdBy: string
    ) => Effect.Effect<UserAccessRow, UserAccessDatabaseError>

    /**
     * List user_access rows ordered by `created_at ASC`, narrowed by each
     * criterion of `filter` that is given (see {@link UserAccessFilter}).
     */
    readonly list: (
      filter: Readonly<UserAccessFilter>
    ) => Effect.Effect<readonly UserAccessRow[], UserAccessDatabaseError>

    /**
     * The accounts among `ids`, in ONE query. Ids naming no account are absent
     * from the answer; an empty `ids` answers an empty list without touching
     * the store.
     */
    readonly findAccounts: (
      ids: readonly string[]
    ) => Effect.Effect<readonly UserAccessAccount[], UserAccessDatabaseError>

    /**
     * The label of each record among `ids` of the source table, in ONE query.
     * Ids naming no record, and records whose label is empty, are absent from
     * the answer; an empty `ids` answers an empty list without touching the
     * store.
     */
    readonly labelRecords: (
      source: Readonly<RecordLabelSource>,
      ids: readonly string[]
    ) => Effect.Effect<readonly RecordLabel[], UserAccessDatabaseError>

    /** The grant with this id, or none. */
    readonly get: (
      id: string
    ) => Effect.Effect<Option.Option<UserAccessRow>, UserAccessDatabaseError>

    /** Apply `change` to the grant with this id; the changed grant, or none when no grant has it. */
    readonly update: (
      id: string,
      change: Readonly<UserAccessChange>
    ) => Effect.Effect<Option.Option<UserAccessRow>, UserAccessDatabaseError>

    /**
     * Add one record to the account's grant over the table under `role`,
     * creating the grant when there is none — ATOMICALLY: grants and
     * revocations of the same account's grants over the same table arriving
     * at once are applied one after the other, so none is lost and none
     * brings back what another took away. `true` when access moved, `false`
     * when the grant already named the record.
     */
    readonly grantRecord: (
      grant: Readonly<UserAccessRecordGrant & { readonly role: string }>,
      createdBy: string
    ) => Effect.Effect<boolean, UserAccessDatabaseError>

    /**
     * Take one record out of EVERY grant the account holds over the table,
     * erasing a grant left naming no record — atomically, as
     * {@link grantRecord}. `true` when access moved, `false` when no grant
     * named the record.
     */
    readonly revokeRecord: (
      grant: Readonly<UserAccessRecordGrant>
    ) => Effect.Effect<boolean, UserAccessDatabaseError>

    /**
     * Erase the grant with this id — a hard delete, never a soft one: a revoked
     * grant leaves nothing a later query could resurrect. The erased grant, or
     * none when no grant has it.
     */
    readonly remove: (
      id: string
    ) => Effect.Effect<Option.Option<UserAccessRow>, UserAccessDatabaseError>
  }
>()('UserAccessRepository') {}
