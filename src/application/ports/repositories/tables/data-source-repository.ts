/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { Effect } from 'effect'

// ============================================================================
// Port-level types
// ============================================================================

export interface DataSourceQueryOptions {
  readonly fields?: readonly string[]
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
  readonly pageSize?: number
  readonly page?: number
  /**
   * Keep only live rows (`deleted_at IS NULL`). Every app table carries the
   * intrinsic `deleted_at` column, so this is safe on any of them.
   */
  readonly liveOnly?: boolean
}

// ============================================================================
// Error type
// ============================================================================

export class DataSourceDatabaseError extends Data.TaggedError('DataSourceDatabaseError')<{
  readonly cause: unknown
}> {}

// ============================================================================
// Repository port
// ============================================================================

/**
 * Data Source Repository Port
 *
 * Provides read-only access to user-defined tables for SSR data binding.
 * Used by the page rendering system to resolve dataSource bindings
 * (list mode, single mode, search mode).
 *
 * Uses dynamic SQL because table/column names come from user app configuration
 * and cannot be expressed as static Drizzle schema references.
 */
export class DataSourceRepository extends Context.Service<
  DataSourceRepository,
  {
    readonly fetchRecords: (
      tableName: string,
      options?: DataSourceQueryOptions
    ) => Effect.Effect<readonly Record<string, unknown>[], DataSourceDatabaseError>

    readonly countRecords: (
      tableName: string,
      filter?: readonly DataFilter[],
      /** `liveOnly`: a soft-deleted row is not counted (`deleted_at IS NULL`). */
      options?: { readonly liveOnly?: boolean }
    ) => Effect.Effect<number, DataSourceDatabaseError>

    readonly fetchSingleRecord: (
      tableName: string,
      paramField: string,
      paramValue: string,
      fields?: readonly string[],
      /** `liveOnly`: a soft-deleted row reads as absent (`deleted_at IS NULL`). */
      options?: { readonly liveOnly?: boolean }
      // eslint-disable-next-line max-params -- positional signature kept for its existing callers; `options` is an optional fifth argument
    ) => Effect.Effect<Record<string, unknown> | undefined, DataSourceDatabaseError>

    /**
     * The ids one record links through each of the given many-to-many fields,
     * read from their junction tables: `fieldName -> relatedIds`. A field the
     * record links nothing through is absent (callers default to `[]`).
     *
     * Used by a single-record form, whose many-to-many fields have no base
     * column for `fetchSingleRecord` to read.
     */
    readonly fetchManyToManyLinks: (
      tableName: string,
      recordId: string,
      fields: readonly { readonly fieldName: string; readonly relatedTable: string }[]
    ) => Effect.Effect<
      Readonly<Record<string, readonly (string | number)[]>>,
      DataSourceDatabaseError
    >

    /**
     * Fetch the flattened set of record-id strings the given user has access
     * to for `tableSlug` from the multi-tenant `user_access` junction.
     *
     * Returns an empty array when the user has no rows or when the
     * `user_access` table does not exist (graceful degradation).
     *
     * Used by the Z-1 `$currentUser.assignments.<tableSlug>` resolver.
     */
    readonly fetchUserAssignments: (
      userId: string,
      tableSlug: string
    ) => Effect.Effect<readonly string[], DataSourceDatabaseError>

    /**
     * Fetch all distinct user_access role names the given user holds across
     * any scope-table. Returns an empty array when no rows exist or the
     * junction table is missing (graceful degradation).
     *
     * Used by the Z-3 row-level enforcement layer to overlay user_access
     * roles onto the Better Auth role for table-level permission gating.
     */
    readonly fetchUserAccessRoles: (
      userId: string
    ) => Effect.Effect<readonly string[], DataSourceDatabaseError>

    /**
     * {@link fetchUserAssignments} for MANY users in ONE query: each user's
     * flattened record ids for `tableSlug`. A user with no row is absent from
     * the map. An empty `userIds` answers an empty map without a query, and a
     * missing `user_access` table answers it too.
     *
     * Used by a door that judges a page of people at once (the comment mention
     * picker), so it reads one query per scope table per page, never per person.
     */
    readonly fetchUsersAssignments: (
      userIds: readonly string[],
      tableSlug: string
    ) => Effect.Effect<ReadonlyMap<string, readonly string[]>, DataSourceDatabaseError>

    /**
     * {@link fetchUserAccessRoles} for MANY users in ONE query: each user's
     * distinct `user_access` role names. A user with no row is absent from the
     * map; an empty `userIds` and a missing `user_access` table both answer an
     * empty map.
     */
    readonly fetchUsersAccessRoles: (
      userIds: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, readonly string[]>, DataSourceDatabaseError>
  }
>()('DataSourceRepository') {}
