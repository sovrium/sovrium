/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { INTRINSIC_ID_COLUMN } from '@/domain/models/app/tables/system-fields'
import { isValidColumnName, validateColumnName } from '../statement/validation'
import type { SQL } from 'drizzle-orm'

/**
 * The structural slice of the app config the sort builders read.
 *
 * Deliberately narrow and STRUCTURAL rather than the real `App`: this module
 * sits in the infrastructure layer and needs two facts about a table — its name
 * and its fields, the latter only to give a single-select sort its declared
 * option order. Typing the parameter as `App` would drag the whole domain model
 * through a SQL-string builder for nothing.
 *
 * Named here rather than repeated inline at each of the three signatures that
 * take it, which is how they had drifted into three verbatim copies.
 */
export type OrderByAppView = {
  readonly tables?: readonly {
    readonly name: string
    readonly fields: readonly unknown[]
  }[]
}

/**
 * A table's declared primary key, as the default-sort-key resolver reads it.
 *
 * Threaded to {@link buildOrderByClause} SEPARATELY from `app`, rather than
 * being looked up inside it, because the two config lookups are independent and
 * only one of them may move. Handing the records-list path the whole `app` would
 * also switch its single-select sorts from alphabetical to declared-option
 * order — a real behaviour change, on a route no spec pins that way, riding
 * along with a bug fix. This parameter buys the default key and nothing else.
 */
export type OrderByPrimaryKey = {
  readonly type?: string
  readonly fields?: readonly string[]
}

/**
 * Find field definition in app schema
 */
function findFieldDefinition(
  app: OrderByAppView,
  tableName: string,
  fieldName: string
): { readonly type?: string; readonly options?: readonly string[] } | undefined {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return undefined

  const field = table.fields.find((f) => {
    const fieldObj = f as { readonly name?: string }
    return fieldObj.name === fieldName
  })

  return field as { readonly type?: string; readonly options?: readonly string[] } | undefined
}

/**
 * Build CASE expression for single-select field sorting.
 *
 * Each option value is BOUND as a parameter, never spliced into the statement:
 * an option is author config, and a value such as `x' THEN 0 END, (SELECT 1) --`
 * must reach the database as data (standing rule S3). The column name was
 * validated by {@link buildSortClause} before it reaches here.
 */
function buildSingleSelectCaseExpression(
  field: string,
  options: readonly string[],
  direction: string
): Readonly<SQL> {
  const caseWhen = sql.join(
    options.map(
      // sql-literal: number -- an option index
      (opt, idx) => sql`WHEN ${sql.identifier(field)} = ${opt} THEN ${sql.raw(String(idx))}`
    ),
    sql.raw(' ')
  )
  // sql-literal: keyword -- `direction` is ASC or DESC
  return sql`CASE ${caseWhen} END ${sql.raw(direction)} NULLS LAST`
}

/**
 * Build sort clause for a single field
 */
function buildSortClause(
  field: string,
  direction: string | undefined,
  app?: OrderByAppView,
  tableName?: string
): Readonly<SQL> {
  validateColumnName(field)
  const dir = direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'

  // Check if this is a single-select field with options
  if (app && tableName) {
    const fieldDef = findFieldDefinition(app, tableName, field)

    if (fieldDef?.type === 'single-select' && fieldDef.options && fieldDef.options.length > 0) {
      return buildSingleSelectCaseExpression(field, fieldDef.options, dir)
    }
  }

  // An empty value sorts last in both directions, on both engines: PostgreSQL
  // defaults NULL to last ascending and first descending, SQLite the reverse,
  // and SQLite (since 3.30) honours the same explicit clause.
  // sql-literal: identifier -- `field` passed validateColumnName; `dir` is ASC or DESC
  return sql.raw(`"${field}" ${dir} NULLS LAST`)
}

/**
 * The order a list request gets when it asks for none.
 *
 * A bare `SELECT ... FROM t` leaves the row sequence to the storage engine,
 * and on PostgreSQL an UPDATE writes a new tuple at the end of the heap under
 * MVCC — so a rewritten row deterministically moves to the end of the next
 * read. That is a correctness bug rather than a cosmetic one: a caller paging
 * an unsorted list reads the moved row twice, or never reads it at all.
 *
 * `id` is the column for almost every dynamic table, and ascending id is
 * creation order — which is what a caller who expressed no preference already
 * believes they are being given. It is NOT universal, though; see
 * {@link defaultOrderByClause}, which resolves the key from the table's
 * declared primary key and only falls back to this constant.
 *
 * Deliberately NOT appended as a tie-breaker to an explicit sort: that would
 * change the result of every already-sorted request that has ties, which is a
 * strictly larger change than this one and needs its own measurement.
 *
 * Double-quoted rather than built through `sql.identifier` because the clause
 * is assembled as a raw string here; this is the same spelling
 * `buildSortClause` emits for a validated column name.
 */
const DEFAULT_ORDER_BY_CLAUSE = ' ORDER BY "id" ASC'

/**
 * The columns a table with no explicit sort is ordered by.
 *
 * A table declaring `primaryKey: { type: 'composite', fields: [...] }` whose
 * fields do not include `id` HAS NO `id` COLUMN — `needsAutomaticIdColumn`
 * (`table-operations/column-generators.ts`) suppresses it, because the composite
 * `PRIMARY KEY (...)` constraint already keys the relation. Naming `id` in the
 * default clause therefore names a column that does not exist, and the two
 * dialects disagree loudly about what that means:
 *
 *   - **PostgreSQL** raises SQLSTATE `42703` (`undefined_column`), which the
 *     error path renders as a **400** blaming the caller's input for a sort the
 *     caller never asked for. Every unsorted list of such a table failed.
 *   - **SQLite** reinterprets an unresolvable double-quoted `"id"` as a string
 *     LITERAL, so the clause silently degrades to a constant and the read
 *     succeeds — which is why the defect stayed invisible on the default engine.
 *
 * The predicate here mirrors `needsAutomaticIdColumn` exactly, and only that
 * one case deviates: `composite` is the sole primary-key type the DDL generator
 * reads `fields` from, so `auto-increment`, `uuid` and `text` keys all keep an
 * `id` column and keep the constant above, byte for byte.
 *
 * ALL the composite fields are emitted rather than just the first. A composite
 * key is unique across its whole tuple, so ordering by all of it is a TOTAL
 * order — the same determinism guarantee `id` gives, which is the entire point
 * of having a default clause at all.
 *
 * Falls back to `id` whenever the answer is not positively knowable: no primary
 * key supplied, a non-composite one, an empty `fields` list, or a name that
 * would not survive {@link isValidColumnName}. A raw string is interpolated
 * here, so an unvalidated config value must never reach the statement.
 */
const compositeKeyFields = (primaryKey?: OrderByPrimaryKey): readonly string[] =>
  primaryKey?.type === 'composite' ? (primaryKey.fields ?? []) : []

/**
 * Whether a composite key both SUPPRESSES the automatic `id` column and is safe
 * to emit — the two halves of "order by this instead".
 *
 * An empty list leaves the automatic id in place, and so does a key naming `id`
 * itself; both keep the constant. `isValidColumnName` is the third condition
 * because the names are interpolated into a raw string rather than bound, so an
 * unusable config value must degrade to `id` and never reach the statement
 * (standing rule S3).
 */
const orderableCompositeKey = (keyFields: readonly string[]): boolean =>
  keyFields.length > 0 &&
  !keyFields.includes(INTRINSIC_ID_COLUMN) &&
  keyFields.every((field) => isValidColumnName(field))

const defaultOrderByClause = (primaryKey?: OrderByPrimaryKey): string => {
  const keyFields = compositeKeyFields(primaryKey)
  return orderableCompositeKey(keyFields)
    ? ` ORDER BY ${keyFields.map((field) => `"${field}" ASC`).join(', ')}`
    : DEFAULT_ORDER_BY_CLAUSE
}

/**
 * Build ORDER BY clause from sort parameter.
 *
 * Falls back to {@link defaultOrderByClause} both when no `sort` is given and
 * when a supplied `sort` yields no usable clause — an unparseable sort has to
 * land on a defined order too, not on the engine's scan order. That fallback
 * resolves the key from the table's declared primary key, because a
 * composite-keyed table has no `id` column to order by.
 *
 * @param sort - Sort parameter (e.g., 'field:asc' or 'field:desc')
 * @param app - Optional App config for single-select field option ordering
 * @param tableName - Optional table name for single-select field lookups
 * @param primaryKey - Optional declared primary key of `tableName`, used only
 *   to resolve the DEFAULT sort key. Omit it and the default stays `id`.
 */
export function buildOrderByClause(
  sort?: string,
  app?: OrderByAppView,
  tableName?: string,
  primaryKey?: OrderByPrimaryKey
): Readonly<ReturnType<typeof sql.raw>> {
  // sql-literal: identifier -- primary-key field names from the table's own schema
  if (!sort) return sql.raw(defaultOrderByClause(primaryKey))

  const sortParts = sort.split(',').map((part) => part.trim())
  const orderClauses = sortParts.flatMap((part) => {
    const [field, direction] = part.split(':')
    return field ? [buildSortClause(field, direction, app, tableName)] : []
  })

  return orderClauses.length > 0
    ? sql`${sql.raw(' ORDER BY ')}${sql.join(orderClauses, sql.raw(', '))}`
    : // sql-literal: identifier -- primary-key field names from the table's own schema
      sql.raw(defaultOrderByClause(primaryKey))
}
