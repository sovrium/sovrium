/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  DataSourceRepository,
  DataSourceDatabaseError,
} from '@/application/ports/repositories/tables/data-source-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { INTRINSIC_DELETED_AT_COLUMN } from '@/domain/models/app/tables/system-fields'
import {
  layerOverDatabase,
  type Dialect,
  type MembersOverDatabase,
} from '@/infrastructure/database/drizzle/layer'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { languageValueSqlOn } from '@/infrastructure/database/sql/translatable-value-sql'
import {
  groupByUser,
  isMissingUserAccessTable,
  readUserAccessRowsOf,
  toRecordIdList,
  type UserAccessRow,
  userAccessTableSql,
} from '@/infrastructure/database/sql/user-access-rows'
import {
  readManyToMany,
  readManyToManyHolders,
  readOneToMany,
} from '@/infrastructure/database/table-queries'
import { buildFilterCondition } from '@/infrastructure/database/table-queries/data-source-filter-condition'
import { maskedRelation } from '@/infrastructure/database/table-queries/query-helpers/lookup-read-mask'
import { readUserListHolders } from '@/infrastructure/database/table-queries/query-helpers/user-list-holders'
import type { DataSourceQueryOptions } from '@/application/ports/repositories/tables/data-source-repository'
import type { LookupReadMask } from '@/application/ports/repositories/tables/table-repository'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { SQL } from 'drizzle-orm'
import type { Context } from 'effect'

/** Wrap a DB promise, adapting failures to DataSourceDatabaseError. */
const wrap = makeDbWrap((error) => new DataSourceDatabaseError({ cause: error }))

// SQL query builders (pure functions — no DB access); one filter's condition
// is built in `table-queries/data-source-filter-condition.ts`

function buildOrderByClause(sort: readonly DataSort[]): Readonly<SQL> | undefined {
  if (sort.length === 0) return undefined
  const terms = sort.map(
    (s) =>
      sql`${sql.identifier(sanitizeTableName(s.field))} ${s.direction === 'desc' ? sql.raw('DESC') : sql.raw('ASC')}`
  )
  return sql`ORDER BY ${sql.join(terms, sql.raw(', '))}`
}

/**
 * `LIMIT`/`OFFSET` as inlined integer literals.
 *
 * These stay literals rather than bound parameters for the same reason the MCP
 * internal-list tool inlines its limit: `LIMIT $1` round-trips poorly through
 * bun:sql's binding path. Both operands are numbers by the time they arrive and
 * are floored here, so neither can carry SQL text.
 */
function buildLimitClause(pageSize?: number, page?: number): Readonly<SQL> | undefined {
  if (!pageSize || pageSize <= 0) return undefined
  const size = Math.floor(pageSize)
  const offset = Math.floor(((page ?? 1) - 1) * size)
  // sql-literal: number -- both operands are floored integers
  return sql`LIMIT ${sql.raw(String(size))} OFFSET ${sql.raw(String(offset))}`
}

/** Join the present clauses with a single space, dropping the absent ones. */
const joinClauses = (clauses: ReadonlyArray<Readonly<SQL> | undefined>): Readonly<SQL> =>
  sql.join(
    clauses.filter((clause): clause is SQL => clause !== undefined),
    sql.raw(' ')
  )

export function buildSelectQuery(
  dialect: DatabaseDialect,
  sanitized: string,
  options: DataSourceQueryOptions,
  relation: Readonly<SQL> = sql`${sql.identifier(sanitized)}`
): Readonly<SQL> {
  const { fields, filter, sort, pageSize, page, liveOnly } = options
  const columns =
    fields && fields.length > 0
      ? sql.join(
          fields.map((f) => sql.identifier(sanitizeTableName(f))),
          sql.raw(', ')
        )
      : sql.raw('*')
  return joinClauses([
    sql`SELECT ${columns} FROM ${relation}`,
    buildWhereClause(dialect, filter ?? [], liveOnly === true),
    sort && sort.length > 0 ? buildOrderByClause(sort) : undefined,
    buildLimitClause(pageSize, page),
  ])
}

export function buildWhereClause(
  dialect: DatabaseDialect,
  filter: readonly DataFilter[],
  liveOnly = false
): Readonly<SQL> | undefined {
  const conditions = [
    ...filter.map((condition) => buildFilterCondition(dialect, condition)),
    ...(liveOnly ? [sql`${sql.identifier(INTRINSIC_DELETED_AT_COLUMN)} IS NULL`] : []),
  ]
  if (conditions.length === 0) return undefined
  return sql`WHERE ${sql.join(conditions, sql.raw(' AND '))}`
}

// ============================================================================
// Database execution helper
// ============================================================================

/**
 * Run a built query string against the ACTIVE database connection.
 *
 * This does not read `process.env.DATABASE_URL` itself and return `[]` when the
 * variable is unset. Such a gate would silently empty every read this
 * repository performs — collection-page slug lookups, page `dataSources`, the
 * row-level `user_access` overlays — on the shipped zero-config default, where
 * `DATABASE_URL` is deliberately absent and the engine runs on SQLite. Nothing
 * would throw and nothing would log, so a collection page would simply 404 as
 * though the row did not exist.
 *
 * The client comes from the `Database` service the layer is built over (Postgres
 * over `bun:sql`, SQLite over `bun:sqlite`), so there is no environment variable
 * to consult here and no per-query connection to open and close — no fresh
 * `SQL` pool is built and torn down per read.
 * `executeRaw` picks `.execute()` or `.all()` for the active dialect and
 * normalizes both to a rows array.
 */
/**
 * Run a Drizzle `SQL` fragment against the active connection.
 *
 * Every query in this repository goes through here. The fragment stays intact
 * all the way to the driver, so `${value}` holes are bound parameters
 * (`$1` / `?`) rather than SQL text. There is deliberately no string-taking
 * sibling: it would have to launder its argument back through `sql.raw`,
 * discarding any distinction between identifier, literal and operator.
 */
async function queryRows<T>(db: PortableDb, dialect: Dialect, query: Readonly<SQL>): Promise<T> {
  return (await executeRawOn(dialect.kind, db, query)) as T
}

/**
 * The relation a read names: the table itself, or — when some of its lookups
 * and counts read as empty for this reader — the records list's own masked
 * relation under the same name, so the filter and the sort steer on the value
 * the reader may read, exactly as her records list does.
 */
const relationOf = (
  database: { readonly db: PortableDb; readonly dialect: Dialect },
  tableName: string,
  masks: readonly LookupReadMask[] | undefined
): Effect.Effect<Readonly<SQL>, DataSourceDatabaseError> =>
  masks === undefined || masks.length === 0
    ? Effect.succeed(sql`${sql.identifier(sanitizeTableName(tableName))}`)
    : maskedRelation({ runner: database.db, dialect: database.dialect }, tableName, masks).pipe(
        Effect.mapError((cause) => new DataSourceDatabaseError({ cause }))
      )

// ============================================================================
// Live implementation
// ============================================================================

/** The repository's service shape. */
type DataSourceService = Context.Service.Shape<typeof DataSourceRepository>

/**
 * The many-to-many links of one record. This member and the two below it read
 * through the link readers, which issue their own queries.
 */
const fetchManyToManyLinks =
  (db: PortableDb, dialect: Dialect): DataSourceService['fetchManyToManyLinks'] =>
  (tableName, recordId, fields) =>
    readManyToMany(
      { client: db, dialect },
      { sourceTable: tableName, sourceIds: [recordId], fields }
    ).pipe(
      Effect.map((byRecord) => byRecord[recordId] ?? {}),
      Effect.mapError((error) => new DataSourceDatabaseError({ cause: error }))
    )

/** The records holding a many-to-many link, read by the link reader. */
const fetchManyToManyHolders =
  (db: PortableDb, dialect: Dialect): DataSourceService['fetchManyToManyHolders'] =>
  (input) =>
    readManyToManyHolders({ client: db, dialect }, input).pipe(
      Effect.mapError((error) => new DataSourceDatabaseError({ cause: error }))
    )

/** The one-to-many links of records, read by the link reader. */
const fetchOneToManyLinks =
  (db: PortableDb, dialect: Dialect): DataSourceService['fetchOneToManyLinks'] =>
  (input) =>
    readOneToMany({ client: db, dialect }, input).pipe(
      Effect.mapError((error) => new DataSourceDatabaseError({ cause: error }))
    )

/**
 * Live implementation of `DataSourceRepository`.
 *
 * Runs through the client of the `Database` service it is built over (see
 * `queryRows` above) — it never opens its own connection per query.
 *
 * **Every method now binds its values (standing rule S3).** The list/count
 * builders — `buildSelectQuery` / `buildWhereClause` / `buildFilterCondition` /
 * `buildInClause` / `buildOrderByClause` — used to assemble a SQL *string*,
 * escaping values with `formatSqlValue` (single-quote doubling) and reducing
 * identifiers to `[a-z0-9_]` with `sanitizeTableName`. They now return Drizzle
 * `SQL` fragments end to end: identifiers go through `sql.identifier()`, values
 * through `${...}` holes that reach the driver as parameters.
 *
 * The conversion had to happen in one pass, which is why it lagged the three
 * chainless methods (`fetchSingleRecord`, `fetchUserAssignments`,
 * `fetchUserAccessRoles`): the moment `buildFilterCondition` returns a bound
 * fragment, every ancestor's return type changes too — you cannot `.join()` a
 * string with a `SQL`.
 *
 * Why it mattered even though no injection was demonstrated through the string
 * form. Escaping is a weaker guarantee than binding: it depends on every
 * builder remembering to apply it, and it assumes `standard_conforming_strings`
 * is on — a Postgres setting this app never asserts, and under which `\'`
 * escapes a doubled quote. The reachability was also not purely config-side, as
 * the old comment implied: `substituteRecordInDataSource`
 * (`presentation/rendering/data-source-resolver.ts`) expands `$record.<field>`
 * from DATABASE ROW VALUES before these builders run, and those rows are
 * writable through the records API. The filter shape was author-controlled; the
 * filter VALUE was not.
 *
 * Note this docstring once claimed every OTHER runtime query path in `src/`
 * binds its values. That was wrong; at least two others still escape a value at
 * runtime — `table-queries/query-helpers/order-by-helpers.ts`
 * (`buildSingleSelectCaseExpression`, a runtime ORDER BY) and
 * `repositories/automations/automation-digest-repository-live.ts` (a JSONB sort
 * key). No uniqueness claim is made here.
 */
const members: MembersOverDatabase<typeof DataSourceRepository> = {
  fetchRecords:
    (db, dialect) =>
    (tableName, options = {}) =>
      Effect.flatMap(relationOf({ db, dialect }, tableName, options.lookupMasks), (relation) =>
        wrap(async () => {
          const query = buildSelectQuery(
            dialect.kind,
            sanitizeTableName(tableName),
            options,
            relation
          )
          return await queryRows<Record<string, unknown>[]>(db, dialect, query)
        })
      ),

  countRecords: (db, dialect) => (tableName, filter, options) =>
    Effect.flatMap(relationOf({ db, dialect }, tableName, options?.lookupMasks), (relation) =>
      wrap(async () => {
        const query = joinClauses([
          sql`SELECT COUNT(*) AS count FROM ${relation}`,
          buildWhereClause(dialect.kind, filter ?? [], options?.liveOnly === true),
        ])
        const rows = await queryRows<Array<{ count: number | string }>>(db, dialect, query)
        return toFiniteCount(rows[0]?.count)
      })
    ),

  fetchSingleRecord: (db, dialect) => (tableName, paramField, paramValue, options) =>
    wrap(async () => {
      const fields = options?.fields
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
      const live =
        options?.liveOnly === true
          ? sql` AND ${sql.identifier(INTRINSIC_DELETED_AT_COLUMN)} IS NULL`
          : sql``
      // A translatable field is compared in one language, through the same
      // expression its per-language index is built over.
      const field = sanitizeTableName(paramField)
      const target =
        options?.paramLanguage === undefined
          ? sql.identifier(field)
          : languageValueSqlOn(dialect.kind, field, options.paramLanguage)
      const rows = await queryRows<Record<string, unknown>[]>(
        db,
        dialect,
        sql`SELECT ${columns} FROM ${sql.identifier(sanitizeTableName(tableName))} WHERE ${target} = ${paramValue}${live} LIMIT 1`
      )
      return rows[0]
    }),

  fetchManyToManyLinks,

  /**
   * Z-1 ($currentUser.assignments.<table>[.<role>]) — flattens record_ids
   * across all user_access rows that match the active user + scope table (+
   * grant role). Every value is bound: `tableSlug` can arrive from a cookie
   * name, and this read decides which records the caller may see.
   *
   * Treats a missing `user_access` table as "no assignments" so apps that
   * don't declare `auth.scopeTables` don't crash.
   */
  fetchUserAssignments: (db, dialect) => (userId, tableSlug, role) =>
    readUserAccessRows({ db, dialect }, [userId], tableSlug, role).pipe(
      Effect.map((rows) => rows.flatMap((row) => toRecordIdList(row.record_ids)))
    ),

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
  fetchUserAccessRoles: (db, dialect) => (userId) =>
    wrap(async () => {
      // `userId` bound — this query feeds the Z-3 role overlay, so a value that
      // could break out of its literal would be choosing its own permissions.
      const query = sql`SELECT DISTINCT ${sql.identifier('role')} FROM ${userAccessTableSql(dialect)} WHERE ${sql.identifier('user_id')} = ${userId}`
      try {
        const rows = await queryRows<Array<{ role: string | null }>>(db, dialect, query)
        return rows
          .map((row) => row.role)
          .filter((role): role is string => typeof role === 'string' && role.length > 0)
      } catch (error) {
        if (isMissingUserAccessTable(error)) {
          return [] as readonly string[]
        }
        throw error
      }
    }),

  fetchUsersAssignments: (db, dialect) => (userIds, tableSlug, role) =>
    readUserAccessRows({ db, dialect }, userIds, tableSlug, role).pipe(
      Effect.map((rows) =>
        groupByUser(rows.map((row) => [row.user_id, toRecordIdList(row.record_ids)] as const))
      )
    ),

  fetchManyToManyHolders,

  fetchOneToManyLinks,

  fetchUserListHolders: (db, dialect) => (input) =>
    readUserListHolders(db, dialect, input).pipe(
      Effect.mapError((error) => new DataSourceDatabaseError({ cause: error }))
    ),

  fetchUsersAccessRoles: (db, dialect) => (userIds) =>
    readUserAccessRows({ db, dialect }, userIds, undefined).pipe(
      Effect.map((rows) =>
        groupByUser(
          rows.map((row) => {
            const { role } = row
            return [row.user_id, typeof role === 'string' && role.length > 0 ? [role] : []] as const
          }),
          { distinct: true }
        )
      )
    ),
}

export const DataSourceRepositoryLive = layerOverDatabase(DataSourceRepository, members)

/**
 * The `user_access` rows of every one of `userIds` — for one scope table, or
 * across all of them — in ONE query (`readUserAccessRowsOf`).
 */
const readUserAccessRows = (
  { db, dialect }: { readonly db: PortableDb; readonly dialect: Dialect },
  userIds: readonly string[],
  tableSlug: string | undefined,
  role?: string
): Effect.Effect<readonly UserAccessRow[], DataSourceDatabaseError> =>
  wrap(() => readUserAccessRowsOf({ runner: db, dialect }, userIds, tableSlug, role))
