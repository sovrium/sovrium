/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { createVolatileFormulaTriggers } from '../formula/formula-trigger-generators'
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

export const applyTableFeatures = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const sanitized = sanitizeTableName(table.name)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    yield* Effect.all(
      [
        executeSQLStatementsParallel(tx, generateIndexStatements(physicalTable)),
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiCategorizeTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiSummaryTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiTagTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiTranslateTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiExtractTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiSentimentTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiGenerateTriggers(physicalTable)),
        Effect.promise(() => createVolatileFormulaTriggers(tx, physicalTableName, table.fields)),
      ],
      { concurrency: 'unbounded' }
    )
  })

export const applyTableFeaturesWithoutIndexes = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const sanitized = sanitizeTableName(table.name)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

    const physicalTable = shouldUseView(table) ? { ...table, name: physicalTableName } : table

    yield* Effect.all(
      [
        executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAutonumberTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable)),
        executeSQLStatements(tx, generateUpdatedAtTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiCategorizeTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiSummaryTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiTagTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiTranslateTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiExtractTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiSentimentTriggers(physicalTable)),
        executeSQLStatements(tx, generateAiGenerateTriggers(physicalTable)),
        Effect.promise(() => createVolatileFormulaTriggers(tx, physicalTableName, table.fields)),
      ],
      { concurrency: 'unbounded' }
    )
  })
