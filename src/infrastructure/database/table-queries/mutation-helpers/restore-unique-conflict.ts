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

import { sql, type SQL } from 'drizzle-orm'
import {
  languageUniqueLabel,
  languageUniqueTargetOf,
} from '@/domain/models/app/tables/translatable-unique-service'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { getBaseTableName } from '@/infrastructure/database/lookup/lookup-view-generators'
import { executeRaw, type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import { liveUniqueIndexName } from '@/infrastructure/database/sql/sql-key-constraints'
import { languageValueSql } from '@/infrastructure/database/sql/translatable-value-sql'
import { databaseTableName, tableIdentifier } from '../statement/validation'

/** One value a live-rows unique index holds: the expression it reads, and how an answer names it. */
interface UniqueTarget {
  /** The value as SQL, read on a row alias of the table. */
  readonly value: (alias: 'r' | 'o') => SQL
  readonly label: string
}

/**
 * The single-column live-rows unique indexes of `tableName`'s rows, with their
 * stored definition: `col` is the column, or `null` for an expression index.
 */
const liveUniqueIndexes = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string
): Promise<readonly Record<string, unknown>[]> => {
  const relation = databaseTableName(tableName)
  const base = getBaseTableName(relation)
  return parseDatabaseDialectConfig().dialect === 'postgres'
    ? executeRaw(
        runner,
        sql`SELECT t.relname AS rel, ic.relname AS name, a.attname AS col, pg_get_indexdef(i.indexrelid) AS def FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0] WHERE i.indisunique AND i.indnatts = 1 AND i.indpred IS NOT NULL AND n.nspname = 'public' AND t.relname IN (${relation}, ${base})`
      )
    : executeRaw(
        runner,
        sql`SELECT m.name AS rel, il.name AS name, ii.name AS col, x.sql AS def FROM sqlite_master AS m JOIN pragma_index_list(m.name) AS il JOIN pragma_index_info(il.name) AS ii LEFT JOIN sqlite_master AS x ON x.type = 'index' AND x.name = il.name WHERE m.type = 'table' AND m.name IN (${relation}, ${base}) AND il."unique" = 1 AND il.partial = 1 AND (SELECT COUNT(*) FROM pragma_index_info(il.name)) = 1`
      )
}

/**
 * What one catalog row holds unique, or `undefined` for an index the engine
 * did not make: a plain field's `<table>_<field>_key`, or a translatable
 * field's `<table>_<field>_<code>_key` over one language ([internal ref] A1), whose
 * field and language are read back from the name and confirmed by the stored
 * definition.
 */
const targetOf = (row: Record<string, unknown>): UniqueTarget | undefined => {
  const name = String(row['name'])
  const rel = String(row['rel'])
  const { col } = row
  if (typeof col === 'string') {
    return name === liveUniqueIndexName(rel, col)
      ? { value: (alias) => sql`${sql.identifier(alias)}.${sql.identifier(col)}`, label: col }
      : undefined
  }
  const def = String(row['def'] ?? '')
  const candidate = /^(.+)_[a-z]{2}_key$/.exec(name.slice(rel.length + 1))?.[1]
  const target =
    candidate === undefined ? undefined : languageUniqueTargetOf(name, rel, [candidate])
  if (target === undefined || !def.includes(target.field) || !def.includes(target.code)) {
    return undefined
  }
  return {
    value: (alias) => languageValueSql(target.field, target.code, alias),
    label: languageUniqueLabel(target.field, target.code),
  }
}

/**
 * The first unique field whose value one of `recordIds` would share, once
 * restored, with a live record or with another of `recordIds` — or `undefined`
 * when the restore duplicates nothing. `recordIds` are the trashed records the
 * restore is about to bring back. A translatable field is named with the
 * language it would collide in, `slug (fr)`.
 */
export const findRestoreUniqueConflict = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string,
  recordIds: readonly string[]
): Promise<string | undefined> => {
  if (recordIds.length === 0) return undefined
  const targets = (await liveUniqueIndexes(runner, tableName)).flatMap((row) => {
    const target = targetOf(row)
    return target === undefined ? [] : [target]
  })
  const table = tableIdentifier(tableName)
  const ids = sql.join(
    recordIds.map((id) => sql`${id}`),
    sql.raw(', ')
  )
  for (const target of targets) {
    const mine = target.value('r')
    const other = target.value('o')
    const hits = await executeRaw(
      runner,
      sql`SELECT 1 AS hit FROM ${table} AS r WHERE r.id IN (${ids}) AND ${mine} IS NOT NULL AND EXISTS (SELECT 1 FROM ${table} AS o WHERE ${other} = ${mine} AND o.id <> r.id AND (o.deleted_at IS NULL OR o.id IN (${ids}))) LIMIT 1`
    )
    if ((hits as readonly unknown[]).length > 0) return target.label
  }
  return undefined
}
