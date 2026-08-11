/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

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
export class UserAccessRepository extends Context.Tag('UserAccessRepository')<
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
     * List user_access rows ordered by `created_at ASC`. When `userId`
     * is provided, results are filtered to the matching user. Used to
     * enumerate scopes for a given user during admin/diagnostic flows.
     */
    readonly list: (
      filter: Readonly<{ userId?: string }>
    ) => Effect.Effect<readonly UserAccessRow[], UserAccessDatabaseError>
  }
>() {}
