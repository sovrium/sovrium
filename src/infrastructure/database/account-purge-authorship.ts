/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  createdByFieldNames,
  deletedByFieldNames,
  updatedByFieldNames,
} from '@/domain/models/app/tables/authorship-fields'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import {
  cascadingChildren,
  userFieldNames,
  type CascadingChild,
  type ErasureReachTable,
} from './account-purge-runs'
import { signatureFieldNames } from './account-purge-signatures'
import { executeRaw, type RawSqlRunner } from './sql/dialect-execute'
import { getExistingColumnNames } from './sql/dialect-introspection'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * The app tables' side of the erasure: which columns of a config-declared table
 * name the erased user, and the sweep that deletes or sheds by them.
 */

/**
 * The authorship stamps that record an act performed ON a record rather than
 * authorship OF it — and which are therefore SHED rather than swept.
 *
 * `created_by` is the opposite case and is handled separately: a record the user
 * authored is their content, so the record itself is deleted. `updated_by` and
 * `deleted_by` stamp somebody else's record — by construction, since a record
 * the erased user authored has already been removed by the `created_by` step. To
 * delete a record because the erased user once edited it would destroy another
 * author's work in the name of the editor's privacy, which is over-deletion, not
 * erasure. So the identifier goes and the record stays, exactly as the
 * `ON DELETE SET NULL` on `record_comments.moderated_by` already decides for
 * moderating another user's comment.
 *
 * Both columns are nullable bare `TEXT` — the foreign key that would have
 * carried a referential action is not generated — so nothing cascades and
 * nothing names them but the shed candidates.
 *
 * These are the LITERAL spellings only. A `updated-by` / `deleted-by` field can
 * be declared under any name, so {@link resolvePurgeTableAuthorship} unions this
 * list with the names resolved from the table's field TYPES. The literals are
 * kept rather than replaced because engine-generated tables (`auth.scopeTables`)
 * carry a literal `updated_by` with no declared field to resolve from.
 */
const SHED_AUTHORSHIP_FIELDS = [AUTHORSHIP_FIELDS.UPDATED_BY, AUTHORSHIP_FIELDS.DELETED_BY] as const

/**
 * One app table's authorship columns, RESOLVED FROM THE CONFIG rather than
 * assumed from the literal column names.
 *
 * The literal names are not a contract. `CreatedByFieldSchema` puts no
 * constraint on `name`, so `{ name: 'author', type: 'created-by' }` is a valid
 * table field and generates a column called `author`; nothing auto-creates a
 * `created_by` alongside it. Matching `created_by` by literal name would delete
 * ZERO app-table rows, silently, for a config that never uses that spelling —
 * `templates/api-only` and `templates/mcp-server` are exactly this shape —
 * behind an HTTP 200 and a truthful-looking `purgedCount: 1`.
 *
 * Resolution is by FIELD TYPE, via the same `authorship-fields` helpers the
 * WRITE path uses. A type-driven write path beside a name-driven erasure path
 * is what makes such a gap invisible: records stamped into `author` correctly
 * and then never swept.
 *
 * The literal names stay in the candidate set alongside the resolved ones —
 * `auth.scopeTables` and other engine-generated tables carry a literal
 * `created_by` with no declared field to resolve from, so dropping the literals
 * would trade one blind spot for another. Every candidate is introspected
 * before use, so extra ones cost nothing but a wider `IN (...)` list.
 */
export interface PurgeTableAuthorship {
  /** The table name. */
  readonly name: string
  /** Columns whose match means "the user AUTHORED this row" — the row is deleted. */
  readonly createdByColumns: readonly string[]
  /** Columns whose match means "the user ACTED ON this row" — the stamp is shed. */
  readonly shedColumns: readonly string[]
  /** The `user` fields: a person named on somebody else's row (`ON DELETE SET NULL`). */
  readonly userColumns?: readonly string[]
  /** The tables whose rows the config deletes with this table's. */
  readonly cascadedBy?: readonly CascadingChild[]
  /** The `signature` fields: her name and image are stripped from the ones she gave. */
  readonly signatureColumns?: readonly string[]
}

/** The app tables as the run scrub reads them: what names her, and what goes with her rows. */
export const erasureReach = (
  appTables: readonly PurgeTableAuthorship[]
): readonly ErasureReachTable[] =>
  appTables.map((table) => ({
    name: table.name,
    createdByColumns: table.createdByColumns,
    namingColumns: [...table.shedColumns, ...(table.userColumns ?? [])],
    cascadedBy: table.cascadedBy ?? [],
  }))

/** {@link PurgeTableAuthorship} narrowed to the columns that actually exist. */
interface ProbedAuthorship {
  readonly createdBy: readonly string[]
  readonly shed: readonly string[]
}

/**
 * Resolve one app table's authorship columns from its declared field types.
 *
 * Exported so the presentation-layer purge trigger builds the same shape the
 * sweep consumes, instead of passing bare table names and letting the
 * infrastructure guess at the column spelling.
 */
export const resolvePurgeTableAuthorship = (
  tables: Parameters<typeof createdByFieldNames>[0],
  tableName: string
): PurgeTableAuthorship => ({
  name: tableName,
  createdByColumns: [
    ...new Set([AUTHORSHIP_FIELDS.CREATED_BY, ...createdByFieldNames(tables, tableName)]),
  ],
  shedColumns: [
    ...new Set([
      ...SHED_AUTHORSHIP_FIELDS,
      ...updatedByFieldNames(tables, tableName),
      ...deletedByFieldNames(tables, tableName),
    ]),
  ],
  userColumns: userFieldNames(tables, tableName),
  cascadedBy: cascadingChildren(tables, tableName),
  signatureColumns: signatureFieldNames(tables, tableName),
})

/**
 * Map each app table to whichever authorship columns it actually carries.
 * Tables with none cannot reference the user through authorship at all.
 *
 * One introspection pass answers for all three columns, because the sweep needs
 * a different verdict per column on the same table (delete on `created_by`, shed
 * on the other two) and probing three times would triple the round trips.
 *
 * Dialect-aware introspection: `getExistingColumnNames` queries
 * `information_schema` on Postgres and `pragma_table_info` on SQLite.
 */
async function authorshipColumnsByTable(
  tx: Readonly<DrizzleTransaction>,
  appTables: readonly PurgeTableAuthorship[]
): Promise<ReadonlyMap<string, ProbedAuthorship>> {
  if (appTables.length === 0) return new Map()

  const sanitized = appTables
    .map((table) => ({ ...table, name: sanitizeTableName(table.name) }))
    .filter((table) => table.name.length > 0)
  if (sanitized.length === 0) return new Map()

  // The transaction handle drives `getExistingColumnNames` as a `RawSqlRunner`
  // — it carries `execute()` (Postgres) or `all()` (SQLite); the helper picks
  // whichever the active dialect needs.
  const runner = tx as RawSqlRunner
  const probed = await Promise.all(
    sanitized.map(async (table) => {
      const candidates = [...new Set([...table.createdByColumns, ...table.shedColumns])]
      const existing = await getExistingColumnNames(runner, table.name, candidates)
      return [
        table.name,
        {
          createdBy: table.createdByColumns.filter((column) => existing.has(column)),
          shed: table.shedColumns.filter((column) => existing.has(column)),
        },
      ] as const
    })
  )
  return new Map(
    probed.filter(([, columns]) => columns.createdBy.length > 0 || columns.shed.length > 0)
  )
}

/**
 * Sweep the app tables' authorship columns, with a different verdict per column.
 *
 * `created_by` DELETES the record: it says the record IS the user's content.
 * `updated_by` / `deleted_by` only NULL the stamp: they say the user acted ON a
 * record that — by construction, since the `created_by` pass has already run —
 * belongs to somebody else. See {@link SHED_AUTHORSHIP_FIELDS}.
 *
 * The delete runs first on each table so the shed only ever touches the
 * survivors, and each table is handled in full before the next so a table
 * carrying all three columns is never left half-swept.
 *
 * @param tx - the open erasure transaction.
 * @param userId - the user being erased.
 * @param appTables - app tables to scan for authorship columns.
 */
export async function sweepAppTableAuthorship(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  appTables: readonly PurgeTableAuthorship[]
): Promise<void> {
  const authorshipTables = await authorshipColumnsByTable(tx, appTables)

  for (const [tableName, columns] of authorshipTables) {
    for (const column of columns.createdBy) {
      await executeRaw(
        tx,
        sql`DELETE FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(column)} = ${userId}`
      )
    }

    for (const column of columns.shed) {
      await executeRaw(
        tx,
        sql`UPDATE ${sql.identifier(tableName)} SET ${sql.identifier(column)} = NULL WHERE ${sql.identifier(column)} = ${userId}`
      )
    }
  }
}
