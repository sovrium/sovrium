/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `required` field ADDED to a table that already holds rows, with nothing to
 * give those rows.
 *
 * The column is added `NOT NULL`, and with no `DEFAULT` neither engine can fill
 * the rows already there: SQLite refuses the `ADD COLUMN` outright and
 * PostgreSQL reports that the column "contains null values". Neither message
 * names the rows that stand in the way, nor what to do about them. So the
 * migration counts the rows BEFORE any DDL and refuses with the table, the
 * field, the row count and the two ways out; the dry run runs the same count
 * and reports the same refusal.
 *
 * Every row counts, trashed ones included: they hold the column too.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { findColumnsToAdd, type ExistingColumnInfo } from '../schema-migration/column-detection'
import { detectFieldRenames } from '../schema-migration/rename-detection'
import { getColumnDefaultExpression } from '../sql/sql-column-generators'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { generateColumnDefinition } from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

type Field = Table['fields'][number]

/**
 * Whether adding `field` as a new column would leave the rows already in the
 * table with no value: `required`, `NOT NULL`, no `DEFAULT` (explicit or
 * implied by its type), and not a column the engine fills itself.
 *
 * @public
 */
export const addsRequiredColumnWithoutDefault = (
  field: Field,
  allFields: readonly Field[],
  dialect: DatabaseDialect
): boolean => {
  if (!('required' in field) || field.required !== true) return false
  if (getColumnDefaultExpression(field, dialect) !== undefined) return false
  const definition = generateColumnDefinition(field, { dialect, allFields })
  return definition.includes(' NOT NULL') && !definition.includes(' SERIAL')
}

/**
 * The refusal for a `required` field with no default added to a table holding rows.
 *
 * @public
 */
export const formatRequiredWithoutDefaultRefusal = (params: {
  readonly tableName: string
  readonly column: string
  readonly rowCount: number
}): string =>
  [
    `\`${params.tableName}.${params.column}\` is \`required\` and the table holds ${params.rowCount} ${params.rowCount === 1 ? 'row' : 'rows'}; give it a \`default\`, or add it optional and make it required once every row has a value.`,
    'Nothing has been changed.',
  ].join('\n')

/**
 * The refusals for every `required` field without a default this migration
 * would add to `source`, a populated table. Read-only: one `SELECT COUNT(*)`,
 * issued only when such a field is being added, so the dry run reuses it
 * verbatim.
 */
export const requiredColumnRefusals = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  /** The relation that holds the rows today. */
  readonly source: string
  readonly existingColumns: ReadonlyMap<string, ExistingColumnInfo>
  readonly previousSchema?: { readonly tables: readonly object[] }
}): Effect.Effect<readonly string[], SQLExecutionError> => {
  const { tx, table, source, existingColumns, previousSchema } = params
  const renamed = new Set(detectFieldRenames(table.name, table.fields, previousSchema).values())
  const fields = findColumnsToAdd(table, existingColumns, renamed).filter((field) =>
    addsRequiredColumnWithoutDefault(field, table.fields, tx.dialect)
  )
  if (fields.length === 0) return Effect.succeed([])
  return executeSQL(tx, `SELECT COUNT(*) AS n FROM ${quoteSqlIdentifier(source)}`).pipe(
    Effect.map((rows) => {
      const rowCount = Number((rows[0] as { readonly n?: unknown } | undefined)?.n ?? 0)
      return rowCount === 0
        ? []
        : fields.map((field) =>
            formatRequiredWithoutDefaultRefusal({
              tableName: table.name,
              column: field.name,
              rowCount,
            })
          )
    })
  )
}

/**
 * Refuse, before any DDL, a migration that would add a `required` field with no
 * default to a table holding rows. Both engines; schema initialisation is one
 * transaction, so nothing else in the same edit is applied either.
 */
export const guardRequiredColumns = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly existingColumns: ReadonlyMap<string, ExistingColumnInfo>
  readonly previousSchema?: { readonly tables: readonly object[] }
}): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const source = getPhysicalTableName(params.table)
    const refusals = yield* requiredColumnRefusals({ ...params, source })
    if (refusals.length === 0) return
    return yield* new SQLExecutionError({ message: refusals.join('\n\n') })
  })
