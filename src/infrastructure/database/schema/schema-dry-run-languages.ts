/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The language warnings `sovrium migrate --dry-run` reports: a translatable
 * field holding values in a language `app.languages` no longer declares.
 *
 * Removing a language changes no column, so no statement names it. Its values
 * stay in the maps (and in every export) but are no longer served or
 * writable, which an operator should hear about before applying the edit —
 * so the plan reads the stored maps and names each language left behind.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import {
  declaresTranslatable,
  recordLanguageOrder,
} from '@/domain/models/app/tables/translatable-field-service'
import * as lookupViewGenerators from '../lookup/lookup-view-generators'
import { executeSQL } from '../sql/sql-execution'
import type { TableChange } from './schema-dry-run'
import type { TransactionLike } from '../sql/sql-execution'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/** The query listing the language codes stored in one translatable column. */
const storedLanguagesQuery = (
  relation: string,
  column: string,
  dialect: DatabaseDialectConfig['dialect']
): string => {
  const from = quoteSqlIdentifier(relation)
  const col = quoteSqlIdentifier(column)
  return dialect === 'sqlite'
    ? `SELECT DISTINCT key AS code FROM ${from}, json_each(${from}.${col}) WHERE json_valid(${from}.${col})`
    : `SELECT DISTINCT jsonb_object_keys(${col}) AS code FROM ${from} WHERE jsonb_typeof(${col}) = 'object'`
}

/** The undeclared language codes stored in one column of `table`. */
const undeclaredStored = (
  tx: TransactionLike,
  table: Table,
  column: string,
  context: {
    readonly declared: readonly string[]
    readonly dialect: DatabaseDialectConfig['dialect']
  }
): Effect.Effect<readonly string[], never> =>
  executeSQL(
    tx,
    storedLanguagesQuery(lookupViewGenerators.getPhysicalTableName(table), column, context.dialect)
  ).pipe(
    Effect.map((rows) =>
      rows
        .map((row) => String((row as { readonly code?: unknown }).code))
        .filter((code) => !context.declared.includes(code))
        .toSorted()
    ),
    // effect-swallow: a column that cannot be read as maps yet (a field this very edit makes translatable, or a table not created) holds no language to warn about; the plan's statements already describe that change, so no warning is the faithful report.
    Effect.orElseSucceed(() => [])
  )

/**
 * One entry per table whose translatable fields hold values in a language the
 * config no longer declares, carrying the warning in its `warnings`; tables
 * with nothing to warn about are left out.
 */
export const planLanguageWarnings = (
  tx: TransactionLike,
  tables: readonly Table[],
  app: App,
  dialect: DatabaseDialectConfig['dialect']
): Effect.Effect<readonly TableChange[], never> => {
  const declared = recordLanguageOrder(app.languages)
  return Effect.forEach(tables, (table) =>
    Effect.forEach(table.fields.filter(declaresTranslatable), (field) =>
      undeclaredStored(tx, table, field.name, { declared, dialect }).pipe(
        Effect.map((codes) =>
          codes.length === 0
            ? []
            : [
                `warning: ${table.name}.${field.name} holds values in ${codes.map((code) => `"${code}"`).join(', ')}, which app.languages no longer declares — they stay stored and exported, but are no longer served or writable`,
              ]
        )
      )
    ).pipe(
      Effect.map((perField): readonly TableChange[] => {
        const warnings = perField.flat()
        return warnings.length === 0
          ? []
          : [
              {
                table: table.name,
                kind: 'unchanged',
                statements: [],
                unsimulated: false,
                refusals: [],
                warnings,
              },
            ]
      })
    )
  ).pipe(Effect.map((perTable) => perTable.flat()))
}
