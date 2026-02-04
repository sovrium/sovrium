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
 * Apply table features (indexes, triggers, field permissions)
 * Shared by both createNewTable and migrateExistingTable
 * Note: Triggers are applied to the base table, not the VIEW
 *
 * Performance optimization: Operations are grouped by dependency:
 * - Group 1 (parallel): indexes, triggers (created-at, autonumber, updated-by, formula)
 * - Group 2 (parallel): field permission grants
 */
export const applyTableFeatures = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Determine actual table name (base table if using VIEW)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

    // Create table object with physical table name for trigger generation
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

    // Group 2: Field permission grants
    yield* executeSQLStatementsParallel(tx, generateFieldPermissionGrants(physicalTable))
  })

/**
 * Apply table features without indexes (triggers, field permissions)
 * Used during migration when indexes are handled separately by syncIndexes
 * Note: Triggers are applied to the base table, not the VIEW
 *
 * Performance optimization: Operations are grouped by dependency:
 * - Group 1 (parallel): triggers (created-at, autonumber, updated-by, formula)
 * - Group 2 (parallel): field permission grants
 */
export const applyTableFeaturesWithoutIndexes = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Determine actual table name (base table if using VIEW)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

    // Create table object with physical table name for trigger generation
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

    // Group 2: Field permission grants
    yield* executeSQLStatementsParallel(tx, generateFieldPermissionGrants(physicalTable))
  })
