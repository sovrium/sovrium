/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { escapeSqlString } from '@/domain/utils/database/sql-formatting'
import { DatabaseError, type DrizzleTransaction } from '@/infrastructure/database'
import {
  columnExists,
  getExistingColumnNames,
} from '@/infrastructure/database/sql/dialect-introspection'
import { generateSqlConditionFragment } from '../filter-operators'
import { validateColumnName } from '../shared/validation'

/**
 * `COUNT(*)` cast to a text type for the active dialect — Postgres uses the
 * `::text` cast, SQLite uses `CAST(... AS TEXT)`.
 */
const countSelectClause = (): string =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? 'CAST(COUNT(*) AS TEXT) as count'
    : 'COUNT(*)::text as count'

/**
 * `COUNT(*)` returned as an integer for the active dialect, ready for callers
 * that build the SELECT clause via Drizzle's typed `sql<number>` literal:
 *
 *   - Postgres: `count(*)::int`
 *   - SQLite:   `CAST(COUNT(*) AS INTEGER)`
 *
 * Drizzle's `bun-sql` driver decodes Postgres `int` directly to a JS number;
 * the SQLite driver returns INTEGER values as numbers natively. Either way the
 * result deserializes as a JS number, matching the Postgres-only call sites
 * that originally hard-coded `count(*)::int`.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Drizzle's `sql<T>` template returns its native mutable `SQL<T>` shape; wrapping in `Readonly<>` breaks Drizzle's typed `.select({ key: sqlExpr })` API which requires `SQL<unknown> | ...`. Same rationale as the dialect-schema selectors.
export const countAsIntSelectClause = (): SQL<number> =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql<number>`CAST(COUNT(*) AS INTEGER)`
    : sql<number>`count(*)::int`

/**
 * Cast an arbitrary Drizzle SQL expression to an integer for the active dialect:
 *
 *   - Postgres: `(<expr>)::int`
 *   - SQLite:   `CAST((<expr>) AS INTEGER)`
 *
 * Used by call sites that already hand-build an aggregate (e.g. `SUM(...)`)
 * and need a dialect-aware integer cast on top.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- same rationale as countAsIntSelectClause above (Drizzle's native mutable SQL shape).
export const castToInt = (expr: SQL): SQL<number> =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql<number>`CAST((${expr}) AS INTEGER)`
    : sql<number>`(${expr})::int`

/**
 * Cast an arbitrary Drizzle SQL expression to a floating-point number for the
 * active dialect:
 *
 *   - Postgres: `(<expr>)::float`
 *   - SQLite:   `CAST((<expr>) AS REAL)`
 *
 * Used by call sites that hand-build a numeric aggregate (e.g. `AVG(...)`)
 * and need a dialect-aware float cast on top.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- same rationale as countAsIntSelectClause above (Drizzle's native mutable SQL shape).
export const castToFloat = (expr: SQL): SQL<number> =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql<number>`CAST((${expr}) AS REAL)`
    : sql<number>`(${expr})::float`

/**
 * Build SQL aggregation SELECT clauses for requested operations
 */
export function buildAggregationSelects(aggregate: {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}): readonly string[] {
  const countSelect = aggregate.count ? [countSelectClause()] : []

  const sumSelects =
    aggregate.sum?.map((field) => {
      validateColumnName(field)
      return `SUM("${field}") as sum_${field}`
    }) ?? []

  const avgSelects =
    aggregate.avg?.map((field) => {
      validateColumnName(field)
      return `AVG("${field}") as avg_${field}`
    }) ?? []

  const minSelects =
    aggregate.min?.map((field) => {
      validateColumnName(field)
      return `MIN("${field}") as min_${field}`
    }) ?? []

  const maxSelects =
    aggregate.max?.map((field) => {
      validateColumnName(field)
      return `MAX("${field}") as max_${field}`
    }) ?? []

  return [...countSelect, ...sumSelects, ...avgSelects, ...minSelects, ...maxSelects]
}

/**
 * Parse count aggregation from result row
 */
function parseCountAggregation(
  row: Readonly<Record<string, unknown>>,
  aggregate: { readonly count?: boolean }
): { readonly count?: string } {
  return aggregate.count && row['count'] !== undefined ? { count: String(row['count']) } : {}
}

/**
 * Parse numeric aggregation fields (sum, avg, min, max)
 */
function parseNumericAggregation(
  row: Readonly<Record<string, unknown>>,
  fields: readonly string[],
  prefix: string
): Readonly<Record<string, number>> {
  return fields.reduce<Record<string, number>>((acc, field) => {
    const key = `${prefix}_${field}`
    if (row[key] !== null && row[key] !== undefined) {
      return { ...acc, [field]: Number(row[key]) }
    }
    return acc
  }, {})
}

/**
 * Parse aggregation result row into structured aggregation object
 */
export function parseAggregationResult(
  row: Readonly<Record<string, unknown>>,
  aggregate: {
    readonly count?: boolean
    readonly sum?: readonly string[]
    readonly avg?: readonly string[]
    readonly min?: readonly string[]
    readonly max?: readonly string[]
  }
): {
  readonly count?: string
  readonly sum?: Readonly<Record<string, number>>
  readonly avg?: Readonly<Record<string, number>>
  readonly min?: Readonly<Record<string, number>>
  readonly max?: Readonly<Record<string, number>>
} {
  const countAgg = parseCountAggregation(row, aggregate)

  const sumAgg =
    aggregate.sum && aggregate.sum.length > 0
      ? { sum: parseNumericAggregation(row, aggregate.sum, 'sum') }
      : {}

  const avgAgg =
    aggregate.avg && aggregate.avg.length > 0
      ? { avg: parseNumericAggregation(row, aggregate.avg, 'avg') }
      : {}

  const minAgg =
    aggregate.min && aggregate.min.length > 0
      ? { min: parseNumericAggregation(row, aggregate.min, 'min') }
      : {}

  const maxAgg =
    aggregate.max && aggregate.max.length > 0
      ? { max: parseNumericAggregation(row, aggregate.max, 'max') }
      : {}

  return {
    ...countAgg,
    ...sumAgg,
    ...avgAgg,
    ...minAgg,
    ...maxAgg,
  }
}

/**
 * Check if table has deleted_at column
 */
export function checkDeletedAtColumn(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Effect.Effect<boolean, DatabaseError> {
  return Effect.tryPromise({
    try: () => columnExists(tx, tableName, 'deleted_at'),
    catch: (error) =>
      new DatabaseError(`Failed to check deleted_at column for ${tableName}`, error),
  })
}

/**
 * A single filter leaf clause (`field <operator> value`).
 */
export interface FilterLeaf {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

/**
 * Nestable filter node (GAP-3): a leaf, an `and` group, or an `or` group.
 * Row-level composite predicates project to this tree; the WHERE builder
 * renders `( … AND … )` / `( … OR … )` groups recursively.
 */
export type FilterNode =
  FilterLeaf | { readonly and: readonly FilterNode[] } | { readonly or: readonly FilterNode[] }

const isLeaf = (node: FilterNode): node is FilterLeaf => 'field' in node && 'operator' in node

const isAndGroup = (node: FilterNode): node is { readonly and: readonly FilterNode[] } =>
  'and' in node && Array.isArray((node as { readonly and?: unknown }).and)

const isOrGroup = (node: FilterNode): node is { readonly or: readonly FilterNode[] } =>
  'or' in node && Array.isArray((node as { readonly or?: unknown }).or)

/**
 * Render a single filter node to a parameterized Drizzle SQL fragment.
 *
 * Leaves go through `generateSqlConditionFragment` (bound parameters); `and`
 * / `or` groups recurse and wrap their children in `( … AND … )` /
 * `( … OR … )`. An empty group renders as a no-op clause so it neither
 * widens nor narrows the surrounding condition.
 */
function renderFilterNode(node: FilterNode): Readonly<SQL> {
  if (isLeaf(node)) {
    validateColumnName(node.field)
    return generateSqlConditionFragment(node.field, node.operator, node.value)
  }
  if (isOrGroup(node)) {
    if (node.or.length === 0) return sql`(1 = 0)` // empty OR matches nothing
    const parts = node.or.map(renderFilterNode)
    return sql`(${sql.join(parts, sql` OR `)})`
  }
  if (isAndGroup(node)) {
    if (node.and.length === 0) return sql`(1 = 1)` // empty AND matches everything
    const parts = node.and.map(renderFilterNode)
    return sql`(${sql.join(parts, sql` AND `)})`
  }
  // Unknown node shape — conservatively match nothing.
  return sql`(1 = 0)`
}

/**
 * Build parameterized filter condition fragments from user-provided filters
 *
 * Returns Drizzle SQL fragments with bound query parameters for all
 * user-supplied filter values (defense-in-depth against SQL injection).
 * Column names are validated via validateColumnName and rendered via
 * sql.identifier() inside generateSqlConditionFragment.
 *
 * Each top-level `and` entry may itself be a nested AND/OR group (GAP-3
 * composite row-level predicates); `renderFilterNode` recurses through them.
 */
export function buildUserFilterConditions(filter?: {
  readonly and?: readonly FilterNode[]
}): readonly Readonly<SQL>[] {
  if (!filter?.and || filter.and.length === 0) return []
  return filter.and.map((node) => renderFilterNode(node))
}

/**
 * Find field definition in app schema
 */
function findFieldDefinition(
  app: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  },
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
 * Build CASE expression for single-select field sorting
 */
function buildSingleSelectCaseExpression(
  field: string,
  options: readonly string[],
  direction: string
): string {
  const caseWhen = options
    .map((opt, idx) => `WHEN "${field}" = '${escapeSqlString(opt)}' THEN ${idx}`)
    .join(' ')
  return `CASE ${caseWhen} END ${direction}`
}

/**
 * Build sort clause for a single field
 */
function buildSortClause(
  field: string,
  direction: string | undefined,
  app?: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  },
  tableName?: string
): string {
  validateColumnName(field)
  const dir = direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'

  // Check if this is a single-select field with options
  if (app && tableName) {
    const fieldDef = findFieldDefinition(app, tableName, field)

    if (fieldDef?.type === 'single-select' && fieldDef.options && fieldDef.options.length > 0) {
      return buildSingleSelectCaseExpression(field, fieldDef.options, dir)
    }
  }

  return `"${field}" ${dir}`
}

/**
 * Build ORDER BY clause from sort parameter
 * @param sort - Sort parameter (e.g., 'field:asc' or 'field:desc')
 * @param app - Optional App config for single-select field option ordering
 * @param tableName - Optional table name for single-select field lookups
 */
export function buildOrderByClause(
  sort?: string,
  app?: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  },
  tableName?: string
): Readonly<ReturnType<typeof sql.raw>> {
  if (!sort) return sql.raw('')

  const sortParts = sort.split(',').map((part) => part.trim())
  const orderClauses = sortParts
    .map((part) => {
      const [field, direction] = part.split(':')
      if (!field) return ''
      return buildSortClause(field, direction, app, tableName)
    })
    .filter((c) => c !== '')

  return orderClauses.length > 0 ? sql.raw(` ORDER BY ${orderClauses.join(', ')}`) : sql.raw('')
}

/**
 * Build a parameterized `LIMIT` / `OFFSET` clause.
 *
 * Three properties are load-bearing:
 *
 * 1. **Both values are BOUND, never interpolated.** They arrive from author
 *    config and, on the records API, from a query string. `sql.raw` here would
 *    be an injection point in the one clause of the statement that is otherwise
 *    entirely static (standing rule S3). `Number.isSafeInteger` rejects `NaN`,
 *    `Infinity` and fractional values before either reaches the driver, so a
 *    non-integer degrades to "no clause" rather than to a syntax error.
 *
 * 2. **Absent means EMPTY.** With neither value the function returns `sql`` `,
 *    so every pre-existing caller — which passes neither — keeps emitting
 *    byte-identical SQL. That is what makes the parameter additive rather than
 *    a migration.
 *
 * 3. **A bare `OFFSET` is PostgreSQL-only.** SQLite's grammar requires a
 *    `LIMIT` before `OFFSET`, where `LIMIT -1` means "no upper bound"; without
 *    the sentinel an offset-only page is a syntax ERROR on the zero-config
 *    default engine while passing on the Postgres the E2E suite defaults to.
 *    Same shape as `user-entity-list-repository-live.ts`'s recent-items prune.
 *
 * An `offset` of 0 emits nothing on its own: skipping no rows is the absence of
 * a clause, and emitting one would cost the SQLite sentinel for no effect.
 */
const pageBound = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined

export function buildPageClause(limit?: number, offset?: number): Readonly<SQL> {
  const pageSize = pageBound(limit)
  const start = pageBound(offset)
  const skips = start !== undefined && start > 0

  if (!skips) return pageSize === undefined ? sql`` : sql` LIMIT ${pageSize}`
  if (pageSize !== undefined) return sql` LIMIT ${pageSize} OFFSET ${start}`

  return parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql` LIMIT -1 OFFSET ${start}`
    : sql` OFFSET ${start}`
}

/**
 * Build the SELECT list for a projected read, or `*` when there is nothing to
 * project.
 *
 * `columns` arrives as a set of CANDIDATES — the caller's requested columns
 * plus the always/optionally-present system ones — and is intersected here with
 * the relation's live catalog. That intersection is the whole point of doing
 * this in the infrastructure layer: `created_by`, `updated_by`, `deleted_by`
 * and `deleted_at` exist only on some tables, and `id` itself is absent from a
 * table that declared its own non-`id` primary key. Emitting a name that is not
 * there is a hard database error, and no amount of reading the app config can
 * settle it as reliably as asking the database.
 *
 * `listTableColumns` (which `getExistingColumnNames` wraps) answers for VIEWS as
 * well as tables on both dialects — `information_schema.columns` includes views
 * on Postgres, `pragma_table_info` accepts one on SQLite — so a lookup /
 * rollup / count column resolves exactly as a stored one does. That is what
 * lets a computed field be projected by name.
 *
 * Names go through `sql.identifier`, which quotes and escapes them; combined
 * with the catalog intersection, every emitted name is one the database just
 * told us it has.
 *
 * An empty intersection degrades to `*` rather than to `SELECT  FROM` — a
 * selection naming nothing addressable returns the whole row and lets the
 * in-memory trim answer, which is the same result by a slower route rather than
 * a 500.
 */
export function buildSelectListClause(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columns: readonly string[] | undefined
): Effect.Effect<Readonly<SQL>, DatabaseError> {
  if (columns === undefined || columns.length === 0) return Effect.succeed(sql.raw('*'))
  return Effect.tryPromise({
    try: async () => {
      const existing = await getExistingColumnNames(tx, tableName, columns)
      const projected = columns.filter((name) => existing.has(name))
      return projected.length === 0
        ? sql.raw('*')
        : sql.join(
            projected.map((name) => sql.identifier(name)),
            sql`, `
          )
    },
    catch: (error) => new DatabaseError(`Failed to resolve projection for ${tableName}`, error),
  })
}

/**
 * Build a parameterized WHERE clause from filter conditions
 *
 * User-supplied filter values are bound as query parameters (not inlined).
 * The soft-delete `deleted_at IS NULL` clause is a static fragment.
 */
export function buildWhereClause(
  hasDeletedAt: boolean,
  includeDeleted: boolean | undefined,
  filter?: {
    readonly and?: readonly FilterNode[]
  }
): Readonly<SQL> {
  const userFilterConditions = buildUserFilterConditions(filter)
  const softDeleteCondition: readonly Readonly<SQL>[] =
    hasDeletedAt && !includeDeleted ? [sql`deleted_at IS NULL`] : []
  const conditions = [...userFilterConditions, ...softDeleteCondition]

  return conditions.length > 0 ? sql` WHERE ${sql.join(conditions, sql` AND `)}` : sql``
}

/**
 * Check which authorship columns exist in a table
 * Returns an object indicating presence of created_by, updated_by, and deleted_by
 */
export function checkAuthorshipColumns(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Effect.Effect<
  {
    readonly hasCreatedBy: boolean
    readonly hasUpdatedBy: boolean
    readonly hasDeletedBy: boolean
  },
  DatabaseError
> {
  return Effect.tryPromise({
    try: async () => {
      const columns = await getExistingColumnNames(tx, tableName, [
        'created_by',
        'updated_by',
        'deleted_by',
      ])
      return {
        hasCreatedBy: columns.has('created_by'),
        hasUpdatedBy: columns.has('updated_by'),
        hasDeletedBy: columns.has('deleted_by'),
      }
    },
    catch: (error) =>
      new DatabaseError(`Failed to check authorship columns for ${tableName}`, error),
  })
}
