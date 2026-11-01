/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  createVolatileFormulaTriggers,
  generatePostgresFormulaBackfill,
  generateSqliteFormulaBackfill,
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
import { shouldUseView, getPhysicalTableName } from '../lookup/lookup-view-generators'
import { executeSQLStatements, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { generateSqliteDateNormalisation } from './sqlite-date-normalisation'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

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
  if (tx.dialect === 'sqlite') {
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
    // The seven siblings above all go through `executeSQLStatements`, which
    // reports a rejected statement as `SQLExecutionError`. This one issues the
    // same kind of DDL through a helper and claimed it could not fail, so a
    // formula trigger that PostgreSQL refused aborted the migration as a defect
    // instead of rolling it back with a statement to point at.
    Effect.tryPromise({
      try: () => createVolatileFormulaTriggers(tx, physicalTableName, physicalTable.fields),
      catch: (error) =>
        new SQLExecutionError({
          message: `Volatile formula trigger setup failed for ${physicalTableName}: ${String(error)}`,
          cause: error,
        }),
    }),
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
    // The physical relation (the base table if the table is view-backed)
    const physicalTableName = getPhysicalTableName(table)

    // Create table object with physical table name for trigger generation
    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    // Indexes and triggers, all independent, one after the other on the one
    // transaction connection. The created/autonumber/updated triggers are
    // dialect-aware in `trigger-generators.ts`; `advancedTriggerEffects` keeps
    // the PL/pgSQL AI triggers Postgres-only while emitting the formula
    // triggers on both.
    yield* Effect.all(
      [
        executeSQLStatements(tx, generateIndexStatements(physicalTable, tx.dialect)),
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable, tx.dialect)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable, tx.dialect)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable, tx.dialect)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable, tx.dialect)),
        ...advancedTriggerEffects(tx, physicalTable, physicalTableName),
      ],
      { discard: true }
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
    // The physical relation (the base table if the table is view-backed)
    const physicalTableName = getPhysicalTableName(table)

    // Create table object with physical table name for trigger generation
    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    // Triggers, all independent, one after the other on the one transaction
    // connection. AI triggers are PL/pgSQL and Postgres-only; the formula
    // triggers run on both engines — see `advancedTriggerEffects`.
    yield* Effect.all(
      [
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable, tx.dialect)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable, tx.dialect)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable, tx.dialect)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable, tx.dialect)),
        ...advancedTriggerEffects(tx, physicalTable, physicalTableName),
      ],
      { discard: true }
    )
  })

/**
 * The statements that compute every trigger-computed formula for the rows
 * already in the table — what {@link backfillTriggerFormulas} runs, and what
 * `sovrium migrate --dry-run` prints for it. Empty for a table with none.
 */
export const triggerFormulaBackfillStatements = (
  table: Table,
  dialect: DatabaseDialect
): readonly string[] => {
  const physicalTableName = getPhysicalTableName(table)
  const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table
  return dialect === 'sqlite'
    ? generateSqliteFormulaBackfill(
        physicalTableName,
        physicalTable.fields,
        generateUpdatedAtTriggers(physicalTable, dialect)
      )
    : generatePostgresFormulaBackfill(physicalTableName, physicalTable.fields)
}

/**
 * Compute every trigger-computed formula for the rows already in the table.
 *
 * A formula trigger fills its column when a row is written, so the migration
 * that adds or edits such a formula runs this once, after the triggers are in
 * place: the rows already in the table then read the new values rather than
 * `null` or what the previous formula computed.
 */
export const backfillTriggerFormulas = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  executeSQLStatements(tx, triggerFormulaBackfillStatements(table, tx.dialect))

/**
 * SQLite: rewrite the datetimes and times written before the write path stored
 * them in one form (see `sqlite-date-normalisation.ts`). A no-op on PostgreSQL,
 * which has always stored both as native values, and a scan that writes
 * nothing on a table whose values are already in the stored form.
 */
export const normaliseSqliteDateValues = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> => {
  if (tx.dialect !== 'sqlite') return Effect.void
  const physicalTableName = getPhysicalTableName(table)
  const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table
  return executeSQLStatements(
    tx,
    generateSqliteDateNormalisation(
      physicalTableName,
      table,
      generateUpdatedAtTriggers(physicalTable, tx.dialect)
    )
  )
}
