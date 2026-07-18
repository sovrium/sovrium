/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { shouldUseView, getBaseTableName } from '../lookup/lookup-view-generators'
import { executeSQL, SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import { generateCreateTableSQL } from './create-table-sql'
import { areTypesCompatible } from './type-compatibility'
import type { Table } from '@/domain/models/app/tables'

export const getCompatibleColumns = (
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
  newColumnInfo: ReadonlyMap<string, { columnDefault: string | null; dataType: string }>
): readonly string[] =>
  Array.from(existingColumns.keys()).filter((col) => {
    const newColInfo = newColumnInfo.get(col)
    if (!newColInfo) return false
    const oldType = existingColumns.get(col)?.dataType.toLowerCase() ?? ''
    return areTypesCompatible(oldType, newColInfo.dataType.toLowerCase())
  })

interface CopyDataParams {
  readonly tx: TransactionLike
  readonly tempTableName: string
  readonly physicalTableName: string
  readonly commonColumns: readonly string[]
  readonly newColumnInfo: ReadonlyMap<string, { columnDefault: string | null; dataType: string }>
}

export const copyDataAndResetSequences = (
  params: CopyDataParams
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { tx, tempTableName, physicalTableName, commonColumns, newColumnInfo } = params
    if (commonColumns.length === 0) return

    const columnList = commonColumns.join(', ')
    yield* executeSQL(
      tx,
      `INSERT INTO ${tempTableName} (${columnList}) SELECT ${columnList} FROM ${physicalTableName}`
    )

    const serialColumns = commonColumns.filter((col) =>
      newColumnInfo.get(col)?.columnDefault?.includes('nextval')
    )
    yield* Effect.forEach(serialColumns, (col) =>
      executeSQL(
        tx,
        `SELECT setval(pg_get_serial_sequence('${tempTableName}', '${col}'), COALESCE((SELECT MAX(${col}) FROM ${tempTableName}), 1), true)`
      )
    )
  })

const fetchColumnInfo = (
  tx: TransactionLike,
  tableName: string
): Effect.Effect<
  Map<string, { columnDefault: string | null; dataType: string }>,
  SQLExecutionError
> =>
  Effect.gen(function* () {
    const columns = yield* executeSQL(
      tx,
      `SELECT column_name, column_default, data_type FROM information_schema.columns WHERE table_name = '${tableName}'`
    )
    return new Map(
      (
        columns as readonly {
          column_name: string
          column_default: string | null
          data_type: string
        }[]
      ).map((row) => [
        row.column_name,
        { columnDefault: row.column_default, dataType: row.data_type },
      ])
    )
  })

const finalizeTableRecreation = (
  tx: TransactionLike,
  physicalTableName: string,
  tempTableName: string
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
    yield* executeSQL(tx, `DROP TABLE ${physicalTableName}${cascadeSuffix}`)
    yield* executeSQL(tx, `ALTER TABLE ${tempTableName} RENAME TO ${physicalTableName}`)
    if (!isSqliteRuntime()) {
      yield* executeSQL(
        tx,
        `DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = '${physicalTableName}'::regclass
      AND position('${tempTableName}_' in conname) = 1
  LOOP
    EXECUTE format(
      'ALTER TABLE ${physicalTableName} RENAME CONSTRAINT %I TO %I',
      r.conname,
      replace(r.conname, '${tempTableName}_', '${physicalTableName}_')
    );
  END LOOP;
END $$`
      )
    }
  })

export const recreateTableWithDataEffect = (
  tx: TransactionLike,
  table: Table,
  existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const sanitized = sanitizeTableName(table.name)
    const physicalTableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
    const tempTableName = `${physicalTableName}_migration_temp`

    const createTableSQL = yield* Effect.try({
      try: () =>
        generateCreateTableSQL(table, tableUsesView)
          .replace(
            `CREATE TABLE IF NOT EXISTS ${physicalTableName}`,
            `CREATE TABLE ${tempTableName}`
          )
          .replaceAll(`CONSTRAINT ${physicalTableName}_`, `CONSTRAINT ${tempTableName}_`),
      catch: (error) =>
        new SQLExecutionError({
          message: `Failed to generate CREATE TABLE DDL for migration: ${String(error)}`,
          cause: error,
        }),
    })
    yield* executeSQL(tx, createTableSQL)

    const newColumnInfo = yield* fetchColumnInfo(tx, tempTableName)
    const commonColumns = getCompatibleColumns(existingColumns, newColumnInfo)
    yield* copyDataAndResetSequences({
      tx,
      tempTableName,
      physicalTableName,
      commonColumns,
      newColumnInfo,
    })

    yield* finalizeTableRecreation(tx, physicalTableName, tempTableName)
  })
