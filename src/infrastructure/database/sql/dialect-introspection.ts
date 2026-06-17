/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { executeRaw, type RawSqlRunner } from './dialect-execute'


export interface IntrospectedColumn {
  readonly name: string
  readonly dataType: string
  readonly isNullable: boolean
  readonly columnDefault: string | null
}

interface PgColumnRow {
  readonly column_name: string
  readonly data_type: string
  readonly is_nullable: string
  readonly column_default: string | null
}

interface SqlitePragmaRow {
  readonly name: string
  readonly type: string
  readonly notnull: number
  readonly dflt_value: string | null
}

export const listTableColumns = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string
): Promise<ReadonlyArray<IntrospectedColumn>> => {
  const { dialect } = parseDatabaseDialectConfig()

  if (dialect === 'postgres') {
    const rows = (await executeRaw(
      runner,
      sql`SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = ${tableName}
            AND table_schema = 'public'`
    )) as unknown as ReadonlyArray<PgColumnRow>
    return rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      columnDefault: row.column_default,
    }))
  }

  const rows = (await executeRaw(
    runner,
    sql`SELECT name, type, "notnull", dflt_value FROM pragma_table_info(${tableName})`
  )) as unknown as ReadonlyArray<SqlitePragmaRow>
  return rows.map((row) => ({
    name: row.name,
    dataType: row.type,
    isNullable: row.notnull === 0,
    columnDefault: row.dflt_value,
  }))
}

export const getExistingColumnNames = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string,
  columnNames: ReadonlyArray<string>
): Promise<ReadonlySet<string>> => {
  if (columnNames.length === 0) return new Set()
  const wanted = new Set(columnNames)
  const columns = await listTableColumns(runner, tableName)
  return new Set(columns.map((c) => c.name).filter((name) => wanted.has(name)))
}

export const columnExists = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string,
  columnName: string
): Promise<boolean> =>
  (await getExistingColumnNames(runner, tableName, [columnName])).has(columnName)
