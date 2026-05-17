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
export class DataSourceRepository extends Context.Tag('DataSourceRepository')<
  DataSourceRepository,
  {
    readonly fetchRecords: (
      tableName: string,
      options?: DataSourceQueryOptions
    ) => Effect.Effect<readonly Record<string, unknown>[], DataSourceDatabaseError>

    readonly countRecords: (
      tableName: string,
      filter?: readonly DataFilter[]
    ) => Effect.Effect<number, DataSourceDatabaseError>

    readonly fetchSingleRecord: (
      tableName: string,
      paramField: string,
      paramValue: string,
      fields?: readonly string[]
    ) => Effect.Effect<Record<string, unknown> | undefined, DataSourceDatabaseError>

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
  }
>() {}
