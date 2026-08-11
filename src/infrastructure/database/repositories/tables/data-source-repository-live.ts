/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  DataSourceRepository,
  DataSourceDatabaseError,
} from '@/application/ports/repositories/tables/data-source-repository'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { formatLikePattern, formatSqlValue } from '@/domain/utils/database/sql-formatting'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database/drizzle/db-bun'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { DataSourceQueryOptions } from '@/application/ports/repositories/tables/data-source-repository'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SQL } from 'drizzle-orm'

/** Wrap a DB promise, adapting failures to DataSourceDatabaseError. */
const wrap = makeDbWrap((error) => new DataSourceDatabaseError({ cause: error }))

// ============================================================================
// SQL query builders (pure functions — no DB access)
// ============================================================================

const DATA_SOURCE_OPERATOR_MAP: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
}

function buildFilterCondition(filter: DataFilter): string {
  const field = `"${sanitizeTableName(filter.field)}"`
  const { operator, value } = filter

  if (operator === 'contains') {
    // Case-folded on both sides: a bare `LIKE` is case-SENSITIVE on PostgreSQL
    // and case-INSENSITIVE on SQLite, so the same page `dataSource.filters`
    // block would bind different rows depending on the engine. Matches the
    // records-API decision in `table-queries/filter-operators.ts`.
    return `LOWER(${field}) LIKE LOWER(${formatLikePattern(value, 'contains')})`
  }

  if (operator === 'in') {
    return buildInClause(field, value)
  }

  const sqlOp = DATA_SOURCE_OPERATOR_MAP[operator]
  if (sqlOp) {
    return `${field} ${sqlOp} ${formatSqlValue(value)}`
  }

  return `${field} = ${formatSqlValue(value)}`
}

/**
 * Build an `IN (...)` clause from a literal or an array.
 *
 * - Empty array  → `1 = 0` (always-false predicate, returns zero rows)
 * - Non-array    → `field = value` (single-value short-hand)
 * - Array        → `field IN (v1, v2, ...)`
 *
 * Used by `$currentUser.assignments.<table>` resolution where the value is
 * the flattened record-id list from the multi-tenant `user_access` rows.
 */
function buildInClause(field: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '1 = 0'
    const literals = value.map((v) => formatSqlValue(v)).join(', ')
    return `${field} IN (${literals})`
  }
  return `${field} = ${formatSqlValue(value)}`
}

function buildOrderByClause(sort: readonly DataSort[]): string {
  if (sort.length === 0) return ''
  const terms = sort.map((s) => {
    const field = `"${sanitizeTableName(s.field)}"`
    const dir = s.direction === 'desc' ? 'DESC' : 'ASC'
    return `${field} ${dir}`
  })
  return `ORDER BY ${terms.join(', ')}`
}

function buildSelectQuery(sanitized: string, options: DataSourceQueryOptions): string {
  const { fields, filter, sort, pageSize, page } = options
  const columns =
    fields && fields.length > 0 ? fields.map((f) => `"${sanitizeTableName(f)}"`).join(', ') : '*'
  const whereClause =
    filter && filter.length > 0 ? `WHERE ${filter.map(buildFilterCondition).join(' AND ')}` : ''
  const orderByClause = sort && sort.length > 0 ? buildOrderByClause(sort) : ''
  const limitClause =
    pageSize && pageSize > 0 ? `LIMIT ${pageSize} OFFSET ${((page ?? 1) - 1) * pageSize}` : ''
  return [`SELECT ${columns} FROM "${sanitized}"`, whereClause, orderByClause, limitClause]
    .filter(Boolean)
    .join(' ')
}

function buildWhereClause(filter: readonly DataFilter[]): string {
  if (filter.length === 0) return ''
  return `WHERE ${filter.map(buildFilterCondition).join(' AND ')}`
}

// ============================================================================
// Database execution helper
// ============================================================================

/**
 * Run a built query string against the ACTIVE database connection.
 *
 * This used to read `process.env.DATABASE_URL` itself and return `[]` when the
 * variable was unset. That gate silently emptied every read this repository
 * performs — collection-page slug lookups, page `dataSources`, the row-level
 * `user_access` overlays — on the shipped zero-config default, where
 * `DATABASE_URL` is deliberately absent and the engine runs on SQLite. Nothing
 * threw and nothing logged, so a collection page simply 404'd as though the row
 * did not exist.
 *
 * `db` resolves the dialect-appropriate client (Postgres over `bun:sql`, SQLite
 * over `bun:sqlite`) and memoizes it, so there is no environment variable to
 * consult here and no per-query connection to open and close — the previous
 * implementation built and tore down a fresh `SQL` pool on every single read.
 * `executeRaw` picks `.execute()` or `.all()` for the active dialect and
 * normalizes both to a rows array.
 */
async function executeQuery<T>(query: string): Promise<T> {
  return (await executeRaw(db, sql.raw(query))) as unknown as T
}

/**
 * Run a Drizzle `SQL` fragment — the parameter-binding counterpart of
 * {@link executeQuery}.
 *
 * `executeQuery` takes a finished string and has to launder it back through
 * `sql.raw`, which discards any distinction between identifier, literal and
 * operator. This variant keeps the fragment intact all the way to the driver,
 * so `${value}` holes stay bound parameters (`$1` / `?`) instead of becoming
 * SQL text. Prefer it for anything new; see the class docstring below for why
 * the list/count builders still use the string form.
 */
async function executeSqlQuery<T>(query: Readonly<SQL>): Promise<T> {
  return (await executeRaw(db, query)) as unknown as T
}

/**
 * Qualified reference to the engine-managed `user_access` table, as a `SQL`
 * fragment.
 *
 * Postgres keeps it in the dedicated `system` schema; SQLite has no schemas, so
 * the namespace is a flat name prefix (`system_user_access`) — see
 * `schema/user-access-table.ts`, which emits exactly these two names.
 *
 * Both arms render character-for-character what the previous string form did
 * (`"system"."user_access"` / `"system_user_access"`), which is what keeps
 * `isMissingUserAccessTable` working: that guard matches on the driver's error
 * text, and the driver quotes the name back exactly as the statement spelled it.
 */
const userAccessTableSql = (): Readonly<SQL> =>
  isSqliteRuntime()
    ? sql`${sql.identifier('system_user_access')}`
    : sql`${sql.identifier('system')}.${sql.identifier('user_access')}`

/** Every message in an error's transitive `cause` chain, outermost first. */
const causeChainMessages = (error: unknown, depth = 0): readonly string[] => {
  if (depth >= 6 || error === null || typeof error !== 'object') return []
  const node = error as { readonly message?: unknown; readonly cause?: unknown }
  const own = typeof node.message === 'string' ? [node.message] : []
  return [...own, ...causeChainMessages(node.cause, depth + 1)]
}

/**
 * Whether `error` means the `user_access` table has not been created — the
 * normal state for an app that declares no `auth.scopeTables`.
 *
 * Two things this has to survive:
 *
 *   - Dialect phrasing. Postgres says `relation "system.user_access" does not
 *     exist`; SQLite says `no such table: system_user_access`. Matching only the
 *     Postgres wording let every SQLite miss escape as a genuine failure.
 *   - Driver wrapping. These reads now go through Drizzle rather than a raw
 *     `sql.unsafe()`, and Drizzle rethrows as `DrizzleQueryError` with the real
 *     driver error on `cause` — so the whole chain is walked instead of only the
 *     outermost message. (Measured 2026-07-26: `bun:sqlite` surfaces
 *     `SQLiteError` unwrapped, but relying on that would make the guard depend
 *     on an implementation detail of one driver.)
 */
const isMissingUserAccessTable = (error: unknown): boolean =>
  causeChainMessages(error).some(
    (message) =>
      /relation .*user_access.* does not exist/i.test(message) ||
      /no such table:.*user_access/i.test(message)
  )

/**
 * Normalize a stored `record_ids` cell into a list of record ids.
 *
 * Postgres stores it as a native `TEXT[]` and the driver hands back a JS array.
 * SQLite has no array type, so the column is TEXT holding a JSON array (see the
 * SQLite DDL in `schema/user-access-table.ts`) and must be parsed.
 */
const toRecordIdList = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value as readonly string[]
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as readonly string[]) : []
  } catch {
    return []
  }
}

// ============================================================================
// Live implementation
// ============================================================================

/**
 * Live implementation of `DataSourceRepository`.
 *
 * Runs through the shared, memoized `db` client (see `executeQuery` above) — it
 * no longer opens its own connection per query.
 *
 * **Known deviation from standing rule S3, now confined to the list/count
 * builders — do not copy that pattern.** `fetchRecords` and `countRecords` go
 * through `buildSelectQuery` / `buildWhereClause` / `buildFilterCondition` /
 * `buildInClause` / `buildOrderByClause`, which assemble a SQL *string*:
 * identifiers are reduced to `[a-z0-9_]` by `sanitizeTableName` and values are
 * escaped by `formatSqlValue` (single-quote doubling). No injection is currently
 * reachable through them. But escaping is a weaker guarantee than binding — it
 * depends on every builder remembering to apply it, and it assumes
 * `standard_conforming_strings` is on, a Postgres setting this app never
 * asserts and which, when off, lets `\'` escape a doubled quote.
 *
 * The three chainless methods below (`fetchSingleRecord`, `fetchUserAssignments`,
 * `fetchUserAccessRoles`) now bind their values via `executeSqlQuery`. They were
 * separable because none of them calls a builder; the builder chain cannot be
 * converted one leaf at a time, since the moment `buildFilterCondition` returns
 * a bound fragment every ancestor's return type has to change too — you cannot
 * `.join()` a string with a Drizzle `SQL`.
 *
 * This docstring previously claimed every OTHER runtime query path in `src/`
 * binds its values. That was wrong; at least two others also escape a value at
 * runtime — `table-queries/query-helpers/aggregation-helpers.ts`
 * (`buildSingleSelectCaseExpression`, a runtime ORDER BY) and
 * `repositories/automations/automation-digest-repository-live.ts` (a JSONB sort
 * key). No uniqueness claim is made here now.
 */
export const DataSourceRepositoryLive = Layer.succeed(DataSourceRepository, {
  fetchRecords: (tableName, options = {}) =>
    wrap(async () => {
      const sanitized = sanitizeTableName(tableName)
      const query = buildSelectQuery(sanitized, options)
      return await executeQuery<Record<string, unknown>[]>(query)
    }),

  countRecords: (tableName, filter) =>
    wrap(async () => {
      const sanitized = sanitizeTableName(tableName)
      const whereClause = filter && filter.length > 0 ? buildWhereClause(filter) : ''
      const query = [`SELECT COUNT(*) AS count FROM "${sanitized}"`, whereClause]
        .filter(Boolean)
        .join(' ')
      const rows = await executeQuery<Array<{ count: number | string }>>(query)
      return toFiniteCount(rows[0]?.count)
    }),

  fetchSingleRecord: (tableName, paramField, paramValue, fields) =>
    wrap(async () => {
      const columns =
        fields && fields.length > 0
          ? sql.join(
              fields.map((f) => sql.identifier(sanitizeTableName(f))),
              sql.raw(', ')
            )
          : sql.raw('*')
      // `paramValue` is bound, not interpolated. It reaches here as a raw URL
      // path segment on routes that need no session (`/feed.xml`, public
      // collection pages), so it is the least-trusted input this repository
      // handles. Binding also survives `standard_conforming_strings=off`, under
      // which quote-doubling alone stops containing a backslash-escaped quote.
      const rows = await executeSqlQuery<Record<string, unknown>[]>(
        sql`SELECT ${columns} FROM ${sql.identifier(sanitizeTableName(tableName))} WHERE ${sql.identifier(sanitizeTableName(paramField))} = ${paramValue} LIMIT 1`
      )
      return rows[0]
    }),

  /**
   * Z-1 ($currentUser.assignments.<table>) — flattens record_ids across all
   * user_access rows that match the active user + scope table.
   *
   * Treats a missing `user_access` table as "no assignments" so apps that
   * don't declare `auth.scopeTables` don't crash.
   */
  fetchUserAssignments: (userId, tableSlug) =>
    wrap(async () => {
      // Both values bound. `tableSlug` arrives from a COOKIE NAME on the
      // scope-cookie path, which no charset check narrows, and this is the
      // query that decides which records the caller may see — an authorization
      // decision is the last place to rely on escaping rather than binding.
      const query = sql`SELECT ${sql.identifier('record_ids')} FROM ${userAccessTableSql()} WHERE ${sql.identifier('user_id')} = ${userId} AND ${sql.identifier('table_slug')} = ${tableSlug}`
      try {
        const rows = await executeSqlQuery<Array<{ record_ids: unknown }>>(query)
        const flattened = rows.flatMap((row) => toRecordIdList(row.record_ids))
        return flattened
      } catch (error) {
        // Gracefully handle missing `user_access` table (e.g. when an app
        // does not declare `auth.scopeTables`). Other SQL errors fall
        // through to the outer catch.
        if (isMissingUserAccessTable(error)) {
          return [] as readonly string[]
        }
        /* eslint-disable-next-line functional/no-throw-statements */
        throw error
      }
    }),

  /**
   * Z-3 (row-level enforcement) — distinct user_access role names the user
   * holds across any scope-table.
   *
   * Used to overlay user_access roles onto the Better Auth role for
   * table-level permission gating (e.g. a user with Better Auth role
   * 'member' but a user_access row of role 'customer-admin' should be
   * granted READ on tables whose `permissions.read` lists 'customer-admin').
   *
   * Treats a missing `user_access` table as "no roles" (graceful
   * degradation for apps without scopeTables).
   */
  fetchUserAccessRoles: (userId) =>
    wrap(async () => {
      // `userId` bound — this query feeds the Z-3 role overlay, so a value that
      // could break out of its literal would be choosing its own permissions.
      const query = sql`SELECT DISTINCT ${sql.identifier('role')} FROM ${userAccessTableSql()} WHERE ${sql.identifier('user_id')} = ${userId}`
      try {
        const rows = await executeSqlQuery<Array<{ role: string | null }>>(query)
        return rows
          .map((row) => row.role)
          .filter((role): role is string => typeof role === 'string' && role.length > 0)
      } catch (error) {
        if (isMissingUserAccessTable(error)) {
          return [] as readonly string[]
        }
        /* eslint-disable-next-line functional/no-throw-statements */
        throw error
      }
    }),
})
