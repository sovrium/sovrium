/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { generateFieldPermissionGrants } from '../field-permission-generators'
import { createVolatileFormulaTriggers } from '../formula-trigger-generators'
import { generateIndexStatements } from '../index-generators'
import { shouldUseView, getBaseTableName } from '../lookup-view-generators'
import { generateAppUserGrants } from '../rls-grants'
import {
  generateRLSPolicyStatements,
  generateBasicTableGrants,
  generateAuthenticatedBasedGrants,
  generateRoleBasedGrants,
} from '../rls-policy-generators'
import {
  executeSQLStatements,
  executeSQLStatementsParallel,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql-execution'
import {
  generateCreatedAtTriggers,
  generateAutonumberTriggers,
  generateUpdatedByTriggers,
  generateUpdatedAtTriggers,
} from '../trigger-generators'
import type { Table } from '@/domain/models/app/table'

/**
 * Apply table features (indexes, triggers, RLS policies, field permissions)
 * Shared by both createNewTable and migrateExistingTable
 * Note: Triggers and policies are applied to the base table, not the VIEW
 *
 * Performance optimization: Operations are grouped by dependency:
 * - Group 1 (parallel): indexes, triggers (created-at, autonumber, updated-by, formula)
 * - Group 2 (sequential): RLS policies (depends on table existing)
 * - Group 3 (parallel): grants (basic, authenticated, role-based, field-level)
 */
export const applyTableFeatures = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Determine actual table name (base table if using VIEW)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

    // Create table object with physical table name for trigger/policy generation
    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    // Group 1: Indexes and triggers (can run in parallel - all independent)
    // These create IF NOT EXISTS so order doesn't matter
    yield* Effect.all(
      [
        executeSQLStatementsParallel(tx, generateIndexStatements(physicalTable)),
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable)),
        Effect.promise(() => createVolatileFormulaTriggers(tx, physicalTableName, table.fields)),
      ],
      { concurrency: 'unbounded' }
    )

    // Group 2: RLS policies (sequential - must run after table is fully set up)
    // RLS policies depend on the table existing with all columns
    yield* executeSQLStatements(tx, generateRLSPolicyStatements(physicalTable))

    // Group 3: Grants (can run in parallel - all independent)
    // Grant operations don't depend on each other
    yield* Effect.all(
      [
        executeSQLStatementsParallel(tx, generateAppUserGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateBasicTableGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateAuthenticatedBasedGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateRoleBasedGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateFieldPermissionGrants(physicalTable)),
      ],
      { concurrency: 'unbounded' }
    )
  })

/**
 * Apply table features without indexes (triggers, RLS policies, field permissions)
 * Used during migration when indexes are handled separately by syncIndexes
 * Note: Triggers and policies are applied to the base table, not the VIEW
 *
 * Performance optimization: Operations are grouped by dependency:
 * - Group 1 (parallel): triggers (created-at, autonumber, updated-by, formula)
 * - Group 2 (sequential): RLS policies (depends on table existing)
 * - Group 3 (parallel): grants (basic, authenticated, role-based, field-level)
 */
export const applyTableFeaturesWithoutIndexes = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Determine actual table name (base table if using VIEW)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

    // Create table object with physical table name for trigger/policy generation
    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    // Group 1: Triggers (can run in parallel - all independent)
    // These create IF NOT EXISTS so order doesn't matter
    yield* Effect.all(
      [
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable)),
        Effect.promise(() => createVolatileFormulaTriggers(tx, physicalTableName, table.fields)),
      ],
      { concurrency: 'unbounded' }
    )

    // Group 2: RLS policies (sequential - must run after table is fully set up)
    // RLS policies depend on the table existing with all columns
    yield* executeSQLStatements(tx, generateRLSPolicyStatements(physicalTable))

    // Group 3: Grants (can run in parallel - all independent)
    // Grant operations don't depend on each other
    yield* Effect.all(
      [
        executeSQLStatementsParallel(tx, generateAppUserGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateBasicTableGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateAuthenticatedBasedGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateRoleBasedGrants(physicalTable)),
        executeSQLStatementsParallel(tx, generateFieldPermissionGrants(physicalTable)),
      ],
      { concurrency: 'unbounded' }
    )
  })
