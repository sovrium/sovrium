/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  createVolatileFormulaTriggers,
  generateSqliteFormulaTriggers,
} from '../formula/formula-trigger-generators'
import { generateAiCategorizeTriggers } from '../generators/ai-categorize-triggers'
import { generateAiExtractTriggers } from '../generators/ai-extract-triggers'
import { generateAiGenerateTriggers } from '../generators/ai-generate-triggers'
import { generateAiSentimentTriggers } from '../generators/ai-sentiment-triggers'
import { generateAiSummaryTriggers } from '../generators/ai-summary-triggers'
import { generateAiTagTriggers } from '../generators/ai-tag-triggers'
import { generateAiTranslateTriggers } from '../generators/ai-translate-triggers'
import { generateIndexStatements } from '../generators/index-generators'
import {
  generateCreatedAtTriggers,
  generateAutonumberTriggers,
  generateUpdatedByTriggers,
  generateUpdatedAtTriggers,
} from '../generators/trigger-generators'
import { shouldUseView, getBaseTableName } from '../lookup/lookup-view-generators'
import {
  executeSQLStatements,
  executeSQLStatementsParallel,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql/sql-execution'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import type { Table } from '@/domain/models/app/tables'

/**
 * AI-compute triggers (`ai-categorize`, `ai-summary`, `ai-tag`, `ai-translate`,
 * `ai-extract`, `ai-sentiment`, `ai-generate`) are PL/pgSQL — SQLite has no
 * procedural language, so on that engine those columns exist but nothing
 * DB-side computes them.
 *
 * The volatile/chained-formula trigger is NOT in that category, though it used
 * to be skipped alongside them. It has a native SQLite form
 * (`generateSqliteFormulaTriggers`), and it is not optional:
 * `generateFormulaColumn` deliberately emits a PLAIN column for those formulas
 * on BOTH engines, expecting a trigger to fill it. Skipping it on SQLite meant
 * the column was created, writes were accepted, and the value stayed NULL
 * forever — silently, since nothing in the write path can tell an unfilled
 * formula column from a legitimately empty one.
 *
 * @returns every trigger-application effect on Postgres; on SQLite, the formula
 *   triggers only
 */
const advancedTriggerEffects = (
  tx: TransactionLike,
  physicalTable: Table,
  physicalTableName: string
): ReadonlyArray<Effect.Effect<void, SQLExecutionError>> => {
  if (isSqliteRuntime()) {
    return [
      executeSQLStatements(
        tx,
        generateSqliteFormulaTriggers(physicalTableName, physicalTable.fields)
      ),
    ]
  }
  return [
    executeSQLStatements(tx, generateAiCategorizeTriggers(physicalTable)),
    executeSQLStatements(tx, generateAiSummaryTriggers(physicalTable)),
    executeSQLStatements(tx, generateAiTagTriggers(physicalTable)),
    executeSQLStatements(tx, generateAiTranslateTriggers(physicalTable)),
    executeSQLStatements(tx, generateAiExtractTriggers(physicalTable)),
    executeSQLStatements(tx, generateAiSentimentTriggers(physicalTable)),
    executeSQLStatements(tx, generateAiGenerateTriggers(physicalTable)),
    Effect.promise(() =>
      createVolatileFormulaTriggers(tx, physicalTableName, physicalTable.fields)
    ),
  ]
}

/**
 * Apply table features (indexes, triggers)
 * Shared by both createNewTable and migrateExistingTable
 * Note: Triggers are applied to the base table, not the VIEW
 *
 * Field-level permissions are enforced at the application layer,
 * not via PostgreSQL column-level GRANTs.
 */
export const applyTableFeatures = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Sanitize table name for PostgreSQL
    const sanitized = sanitizeTableName(table.name)
    // Determine actual table name (base table if using VIEW)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

    // Create table object with physical table name for trigger generation
    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    // Indexes and triggers (can run in parallel - all independent).
    // The created/autonumber/updated triggers are dialect-aware in
    // `trigger-generators.ts`; `advancedTriggerEffects` keeps the PL/pgSQL AI
    // triggers Postgres-only while emitting the formula triggers on both.
    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- all statements execute on the single reserved transaction connection: width cannot exceed one pooled connection regardless of fan-out.
    yield* Effect.all(
      [
        executeSQLStatementsParallel(tx, generateIndexStatements(physicalTable)),
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable)),
        ...advancedTriggerEffects(tx, physicalTable, physicalTableName),
      ],
      { concurrency: 'unbounded' }
    )
  })

/**
 * Apply table features without indexes (triggers only)
 * Used during migration when indexes are handled separately by syncIndexes
 * Note: Triggers are applied to the base table, not the VIEW
 *
 * Field-level permissions are enforced at the application layer,
 * not via PostgreSQL column-level GRANTs.
 */
export const applyTableFeaturesWithoutIndexes = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // Sanitize table name for PostgreSQL
    const sanitized = sanitizeTableName(table.name)
    // Determine actual table name (base table if using VIEW)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

    // Create table object with physical table name for trigger generation
    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    // Triggers (can run in parallel - all independent).
    // AI triggers are PL/pgSQL and Postgres-only; the formula triggers run on
    // both engines — see `advancedTriggerEffects`.
    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- all statements execute on the single reserved transaction connection: width cannot exceed one pooled connection regardless of fan-out.
    yield* Effect.all(
      [
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable)),
        ...advancedTriggerEffects(tx, physicalTable, physicalTableName),
      ],
      { concurrency: 'unbounded' }
    )
  })
