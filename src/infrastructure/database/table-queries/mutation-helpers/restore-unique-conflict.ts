/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether bringing records back from the trash would leave two live records
 * sharing the value of a `unique` field.
 *
 * Uniqueness covers live records only, so a trashed record may hold a value a
 * live record has taken since. Restoring it would duplicate that value; so would
 * restoring, together, two trashed records sharing one. The check runs BEFORE
 * the write, inside the restore's transaction, and names the field so the
 * caller learns what to change. The live-rows unique index stays the backstop:
 * a concurrent write the check could not see is still refused by the database.
 *
 * The unique fields are read from the live catalog — the live-rows unique
 * indexes `<table>_<field>_key … WHERE deleted_at IS NULL` — so the check needs
 * no config and agrees with what the database enforces.
 */

import { sql } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { getBaseTableName } from '@/infrastructure/database/lookup/lookup-view-generators'
import { executeRaw, type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import { liveUniqueIndexName } from '@/infrastructure/database/sql/sql-key-constraints'
import { databaseTableName, tableIdentifier } from '../statement/validation'

/** The columns a live-rows unique index holds unique on `tableName`'s rows. */
const liveUniqueColumns = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string
): Promise<readonly string[]> => {
  const relation = databaseTableName(tableName)
  const base = getBaseTableName(relation)
  const rows =
    parseDatabaseDialectConfig().dialect === 'postgres'
      ? await executeRaw(
          runner,
          sql`SELECT t.relname AS rel, ic.relname AS name, a.attname AS col FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0] WHERE i.indisunique AND i.indnatts = 1 AND i.indpred IS NOT NULL AND n.nspname = 'public' AND t.relname IN (${relation}, ${base})`
        )
      : await executeRaw(
          runner,
          sql`SELECT m.name AS rel, il.name AS name, ii.name AS col FROM sqlite_master AS m JOIN pragma_index_list(m.name) AS il JOIN pragma_index_info(il.name) AS ii WHERE m.type = 'table' AND m.name IN (${relation}, ${base}) AND il."unique" = 1 AND il.partial = 1 AND (SELECT COUNT(*) FROM pragma_index_info(il.name)) = 1`
        )
  return rows
    .filter(
      (row) => String(row['name']) === liveUniqueIndexName(String(row['rel']), String(row['col']))
    )
    .map((row) => String(row['col']))
}

/**
 * The first unique field whose value one of `recordIds` would share, once
 * restored, with a live record or with another of `recordIds` — or `undefined`
 * when the restore duplicates nothing. `recordIds` are the trashed records the
 * restore is about to bring back.
 */
export const findRestoreUniqueConflict = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string,
  recordIds: readonly string[]
): Promise<string | undefined> => {
  if (recordIds.length === 0) return undefined
  const columns = await liveUniqueColumns(runner, tableName)
  const table = tableIdentifier(tableName)
  const ids = sql.join(
    recordIds.map((id) => sql`${id}`),
    sql.raw(', ')
  )
  for (const column of columns) {
    const col = sql.identifier(column)
    const hits = await executeRaw(
      runner,
      sql`SELECT 1 AS hit FROM ${table} AS r WHERE r.id IN (${ids}) AND r.${col} IS NOT NULL AND EXISTS (SELECT 1 FROM ${table} AS o WHERE o.${col} = r.${col} AND o.id <> r.id AND (o.deleted_at IS NULL OR o.id IN (${ids}))) LIMIT 1`
    )
    if ((hits as readonly unknown[]).length > 0) return column
  }
  return undefined
}
