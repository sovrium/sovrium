/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Database as BunSqlite } from 'bun:sqlite'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { applySqlitePragmas } from './sqlite-pragmas'
import type { TransactionLike } from './sql-execution'

/**
 * Dialect-aware DDL execution for the schema-initializer.
 *
 * Why this module exists
 * ----------------------
 * The dynamic-table DDL *generator* is already dialect-aware (Phase 5). The
 * DDL *executor* — `schema-initializer.ts` and the migration-audit helpers it
 * drives — was still PostgreSQL-only: it built transactions with bun:sql's
 * `new SQL(url)` + `db.begin(tx => …)` and ran raw SQL through the
 * `tx.unsafe()` method.
 *
 * The whole schema-migration layer below `executeMigrationSteps` is uniformly
 * written against the {@link TransactionLike} interface — a single
 * `unsafe(sql): Promise<readonly unknown[]>` method. So porting the executor
 * to SQLite needs exactly one thing: a `TransactionLike` adapter backed by a
 * `bun:sqlite` `Database`. Every helper underneath then works unchanged.
 *
 * This module provides:
 *
 *   - {@link openSqliteDdlDatabase} — open a hardened `bun:sqlite` database.
 *   - {@link sqliteTransactionLike} — wrap a `bun:sqlite` database as a
 *     `TransactionLike` so `executeSQL(tx, …)` runs on SQLite.
 *   - {@link runSqliteSchemaTransaction} — run a unit of DDL work inside an
 *     explicit `BEGIN` / `COMMIT` / `ROLLBACK` transaction on SQLite.
 *   - {@link qualifiedSystemTable} — `system.<name>` on Postgres, the
 *     `system_<name>` flat-prefix table on SQLite (SQLite has no schemas).
 *   - {@link systemObjectExistsSql} — the catalog query for "does a `system`
 *     table exist", per dialect.
 *   - {@link nowSqlLiteral} — the "current timestamp" function for raw SQL
 *     strings (`NOW()` vs `CURRENT_TIMESTAMP`).
 */

/**
 * Open a hardened `bun:sqlite` database for DDL execution.
 *
 * Applies the same production PRAGMAs as every other connection this process
 * opens, from the one module that spells them, so the schema-initializer's
 * connection behaves identically to the connection records-CRUD uses. The file
 * is created if it does not exist (zero-config first boot).
 *
 * This used to hold its own copy of the list with `busy_timeout` LAST, which
 * left its own WAL switch unprotected — that switch takes a lock of its own and
 * fails instantly without a timeout already in force. See
 * {@link applySqlitePragmas} for the measurement.
 */
export const openSqliteDdlDatabase = (path: string): BunSqlite => {
  const client = new BunSqlite(path, { create: true })

  applySqlitePragmas(client)
  return client
}

/**
 * Wrap a `bun:sqlite` database as a {@link TransactionLike}.
 *
 * `TransactionLike.unsafe(sql)` must execute one raw SQL statement and return
 * its rows. The schema-migration layer always passes a single statement per
 * call (`executeSQLStatements` iterates), so the adapter prepares and runs one
 * statement:
 *
 *   - For a row-returning statement (`SELECT`, or DML with `RETURNING`),
 *     `query(sql).all()` returns the rows.
 *   - For a plain DDL/DML statement, `query(sql).all()` returns `[]`.
 *   - A genuinely multi-statement string (rare — defensive only) is run via
 *     `exec()`, which returns no rows.
 *
 * The same `bun:sqlite` `Database` handle is used for every call, so when the
 * adapter is created inside a `BEGIN`/`COMMIT` block (see
 * {@link runSqliteSchemaTransaction}) every statement participates in that one
 * transaction.
 */
export const sqliteTransactionLike = (client: Readonly<BunSqlite>): TransactionLike => ({
  unsafe: (sql: string): Promise<readonly unknown[]> => {
    try {
      // bun:sqlite's query() compiles a single statement. A row-returning
      // statement yields its rows; a non-row statement yields [].
      return Promise.resolve(client.query(sql).all() as readonly unknown[])
    } catch (error) {
      // A multi-statement DDL string cannot be prepared by query(); fall back
      // to exec(), which runs every statement but returns no rows.
      const message = error instanceof Error ? error.message : String(error)
      if (/statement|multiple|prepare/i.test(message)) {
        // eslint-disable-next-line functional/no-expression-statements -- driver call; exec returns void
        client.exec(sql)
        return Promise.resolve([])
      }
      return Promise.reject(error instanceof Error ? error : new Error(message))
    }
  },
})

/** A row of `PRAGMA foreign_key_check`: an orphaned child row and the parent it lost. */
type ForeignKeyViolation = {
  readonly table: string
  readonly parent: string
}

/**
 * Read `PRAGMA foreign_key_check` and, if the database is left inconsistent,
 * describe the breakage in terms an operator can act on (which child table lost
 * which parent, and how many rows).
 *
 * Returns `undefined` when the database is consistent.
 */
const describeForeignKeyViolations = (client: Readonly<BunSqlite>): string | undefined => {
  const violations = client
    .query('PRAGMA foreign_key_check')
    .all() as readonly ForeignKeyViolation[]
  if (violations.length === 0) return undefined
  const pairs = violations.map((violation) => `'${violation.table}' -> '${violation.parent}'`)
  const summary = Array.from(new Set(pairs))
    .map((pair) => {
      const count = pairs.filter((candidate) => candidate === pair).length
      return `${pair} (${count} row${count === 1 ? '' : 's'})`
    })
    .join(', ')
  return `FOREIGN KEY constraint failed: migration would leave orphaned rows: ${summary}`
}

/**
 * Run a unit of DDL work inside an explicit SQLite transaction.
 *
 * `bun:sqlite`'s `Database.transaction()` requires a *synchronous* callback, so
 * it cannot wrap an async Effect run. Instead this helper drives the
 * transaction boundary by hand: `BEGIN`, run the async work, then `COMMIT` on
 * success or `ROLLBACK` on failure. This mirrors the atomicity the PostgreSQL
 * `db.begin(tx => …)` path provides — if any DDL statement throws, the whole
 * schema migration rolls back and no partial schema is left behind.
 *
 * FK suspension: this follows SQLite's documented procedure for "other kinds of
 * table schema changes" (<https://sqlite.org/lang_altertable.html#otheralter>) —
 * `PRAGMA foreign_keys = OFF`, then `BEGIN`, then the DDL, then
 * `PRAGMA foreign_key_check`, then `COMMIT`, then `PRAGMA foreign_keys = ON`.
 *
 * The pragma MUST be issued BEFORE `BEGIN`: `PRAGMA foreign_keys` is a silent
 * no-op inside an open transaction, so setting it after `BEGIN` changes nothing.
 *
 * This replaced `PRAGMA defer_foreign_keys = ON`, which did NOT work. Deferral
 * postpones the FK check to `COMMIT`; it does not exempt statements from it.
 * The engine never emits `ALTER COLUMN` on SQLite (see
 * `generateColumnReshapeStatements` in `../schema-migration/migration-statements`
 * for why), so any column-affecting change is reconciled by
 * `recreateTableWithDataEffect`: create temp, copy, `DROP TABLE` the original,
 * rename the temp into place. `DROP TABLE` on a *referenced* parent implicitly
 * deletes its rows and arms the deferred-violation counter once per orphaned
 * CHILD row; the following `ALTER TABLE … RENAME` is DDL and never decrements
 * it, so `COMMIT` failed with `FOREIGN KEY constraint failed` and the app would
 * not boot. The failure needed BOTH an inbound FK and at least one child row —
 * which is why a leaf table, an empty child, and Postgres all passed, and why
 * the defect survived a schema-evolution suite written against standalone
 * tables.
 *
 * Suspending enforcement outright would trade that brick for a silent one, so
 * the documented `foreign_key_check` gate is kept: a migration that genuinely
 * leaves a dangling reference is still rejected before `COMMIT` — now naming the
 * offending tables — so final consistency is preserved. The check runs only on a
 * boot that performs schema work, and enforcement is restored in `finally`, so
 * runtime FK behaviour is untouched either way.
 *
 * @param client - an open `bun:sqlite` database
 * @param work - async work that runs raw SQL through the supplied `TransactionLike`
 */
export const runSqliteSchemaTransaction = async (
  client: Readonly<BunSqlite>,
  work: (tx: TransactionLike) => Promise<void>
): Promise<void> => {
  const tx = sqliteTransactionLike(client)
  // eslint-disable-next-line functional/no-expression-statements -- MUST precede BEGIN: this pragma is a no-op inside an open transaction
  client.exec('PRAGMA foreign_keys = OFF')
  // eslint-disable-next-line functional/no-expression-statements -- transaction boundary
  client.exec('BEGIN')
  try {
    await work(tx)
    const violation = describeForeignKeyViolations(client)
    // eslint-disable-next-line functional/no-throw-statements -- reject before COMMIT so a genuinely dangling reference still rolls back
    if (violation) throw new Error(violation)
    // eslint-disable-next-line functional/no-expression-statements -- commit on success
    client.exec('COMMIT')
  } catch (error) {
    // eslint-disable-next-line functional/no-expression-statements -- roll back so no partial schema survives
    client.exec('ROLLBACK')
    // eslint-disable-next-line functional/no-throw-statements -- re-raise so the caller's tryPromise maps it to SchemaInitializationError
    throw error instanceof Error ? error : new Error(String(error))
  } finally {
    // eslint-disable-next-line functional/no-expression-statements -- restore runtime enforcement; only takes effect outside the transaction
    client.exec('PRAGMA foreign_keys = ON')
  }
}

/**
 * Qualified table name for a `system`-namespace table.
 *
 * The PostgreSQL schema-migration tables live in a dedicated `system`
 * PostgreSQL schema (`system.schema_checksum`). SQLite has no schemas, so the
 * `schema-sqlite/` mirror prefixes the name instead (`system_schema_checksum`,
 * via the `systemTable()` helper). This returns the dialect-correct reference
 * for use inside raw SQL strings.
 *
 * @param bareName - the unqualified table name (e.g. `schema_checksum`)
 */
export const qualifiedSystemTable = (bareName: string): string =>
  isSqliteRuntime() ? `system_${bareName}` : `system.${bareName}`

/**
 * Qualified table name for an `auth`-namespace table (Better Auth tables).
 *
 * The PostgreSQL Better Auth tables live in a dedicated `auth` PostgreSQL
 * schema (`auth.user`, `auth.session`, …). SQLite has no schemas, so the
 * `schema-sqlite/` mirror prefixes the name instead (`auth_user`,
 * `auth_session`, …). This returns the dialect-correct reference for use
 * inside raw SQL strings — the raw-string counterpart of `authTableRef()` in
 * `dialect-sql.ts` (which produces a Drizzle `sql.raw` fragment for the
 * records-CRUD layer).
 *
 * Use this from raw-SQL builders that emit a FK constraint or a join target —
 * e.g. the `FOREIGN KEY (...) REFERENCES auth.user(id)` text generated by
 * `generateForeignKeyConstraints()`.
 *
 * @param bareName - the unqualified Better Auth table name (e.g. `user`)
 */
export const qualifiedAuthTable = (bareName: string): string =>
  isSqliteRuntime() ? `auth_${bareName}` : `auth.${bareName}`

/**
 * Catalog query that resolves to a single `exists` boolean column reporting
 * whether the `system`-namespace table `bareName` exists.
 *
 * - PostgreSQL: `information_schema.tables` scoped to the `system` schema.
 * - SQLite: `sqlite_master` matched against the `system_<name>` flat-prefix
 *   physical table name.
 *
 * @param bareName - the unqualified table name (e.g. `schema_checksum`)
 */
export const systemObjectExistsSql = (bareName: string): string =>
  isSqliteRuntime()
    ? `SELECT EXISTS (
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = 'system_${bareName}'
      ) as "exists"`
    : `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'system' AND table_name = '${bareName}'
      ) as exists`

/**
 * SQLite "current timestamp" expression that produces a true ISO-8601 string.
 *
 * SQLite's bare `CURRENT_TIMESTAMP` yields `'YYYY-MM-DD HH:MM:SS'` — a
 * space-separated form with no `T` separator and no `Z` suffix, which is NOT
 * valid ISO-8601. The dynamic-table `created_at`/`updated_at` columns are read
 * back through the records API, whose response schema validates them with
 * `z.string().datetime()` (strict ISO-8601). `strftime` with the
 * `'%Y-%m-%dT%H:%M:%fZ'` format string produces a millisecond-precision
 * ISO-8601 UTC timestamp (e.g. `2026-05-19T12:34:56.789Z`) that the schema
 * accepts. Used for both the column `DEFAULT` and the `AFTER UPDATE` trigger.
 */
export const SQLITE_ISO_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"

/**
 * The "current timestamp" SQL function for raw SQL strings.
 *
 * - PostgreSQL: `NOW()` — a `timestamptz`.
 * - SQLite: an ISO-8601 `TEXT` value via `strftime` (see {@link SQLITE_ISO_NOW})
 *   — SQLite has no `NOW()` and stores timestamps as text, and the records API
 *   response schema requires strict ISO-8601.
 *
 * This is the raw-string-SQL counterpart of `nowExpr()` in `dialect-sql.ts`
 * (which produces a Drizzle `sql` fragment for the records-CRUD layer).
 *
 * Use this for ISO-TEXT-storage timestamp columns (the dynamic-records
 * `created_at`/`updated_at` shape). For INTEGER `timestamp_ms` columns (the
 * `system_sovrium_bootstrap_tokens.created_at` shape on SQLite), use
 * {@link nowEpochMsSqlLiteral} instead.
 */
export const nowSqlLiteral = (): string => (isSqliteRuntime() ? SQLITE_ISO_NOW : 'NOW()')

/**
 * The "current timestamp as epoch-milliseconds INTEGER" SQL expression.
 *
 * - PostgreSQL: `NOW()` — a `timestamptz`. PG implicitly accepts a
 *   `timestamptz` insert into any timestamp-or-text-shaped column, so reusing
 *   `NOW()` keeps the PG path semantically unchanged.
 * - SQLite: `(CAST(strftime('%s','now') AS INTEGER) * 1000)` — emits a true
 *   integer millisecond value, matching the
 *   `integer('created_at', { mode: 'timestamp_ms' })` shape used by SQLite
 *   system-table mirrors such as `system_sovrium_bootstrap_tokens`. Using
 *   {@link nowSqlLiteral} here would write the ISO-8601 TEXT into an INTEGER
 *   column and break Drizzle's `timestamp_ms` decoder on read.
 *
 * This is the second of two "now()" raw-string helpers (the first being
 * {@link nowSqlLiteral}); pick the one that matches the destination column's
 * storage shape.
 */
export const nowEpochMsSqlLiteral = (): string =>
  isSqliteRuntime() ? "(CAST(strftime('%s','now') AS INTEGER) * 1000)" : 'NOW()'

/**
 * Cast a raw SQL expression to TEXT for the active dialect.
 *
 * PG accepts the `::text` shorthand; SQLite uses `CAST(expr AS TEXT)` and
 * rejects `::text` with a parser error.
 */
const castToText = (expr: string): string =>
  isSqliteRuntime() ? `CAST(${expr} AS TEXT)` : `${expr}::TEXT`

/**
 * String aggregation expression for the active dialect — the SQL idiom that
 * collapses a column from many rows into a single delimited text value.
 *
 * - PostgreSQL: `STRING_AGG(<expr>::TEXT, '<separator>' ORDER BY <orderBy>)`
 *   — `STRING_AGG` is the canonical SQL-standard form; the `::TEXT` cast
 *   normalises non-text columns to a stable string representation; the
 *   inline `ORDER BY` clause inside the aggregate sorts the input rows
 *   deterministically.
 * - SQLite: `group_concat(CAST(<expr> AS TEXT) ORDER BY <orderBy>, '<separator>')`
 *   — `group_concat` is SQLite's spelling; the `ORDER BY` inside the
 *   aggregate is supported in SQLite 3.44+ (bun:sqlite ships 3.50+ so this
 *   is always available); separator is a positional argument, NOT a
 *   second template form like PG.
 *
 * The separator is inlined as a SQL literal — callers must pass a safe
 * fixed value (typically `', '`). The expression and the optional orderBy
 * column are interpolated unquoted; they're assumed to be already-escaped
 * identifier references (e.g. `alias.col`).
 *
 * @param expression - the source expression (e.g. `alias.field` or `alias.field::TEXT`)
 * @param separator - the delimiter literal (interpolated unquoted; pass `', '`)
 * @param orderByExpression - optional ORDER BY expression for stable ordering
 */
export const stringAggExpression = (
  expression: string,
  separator: string,
  orderByExpression?: string
): string => {
  const sortClause = orderByExpression ? ` ORDER BY ${orderByExpression}` : ''
  if (isSqliteRuntime()) {
    // SQLite: `group_concat(CAST(expr AS TEXT) ORDER BY x, ', ')`
    return `group_concat(${castToText(expression)}${sortClause}, '${separator}')`
  }
  // Postgres: `STRING_AGG(expr::TEXT, ', ' ORDER BY x)`
  return `STRING_AGG(${castToText(expression)}, '${separator}'${sortClause})`
}

/**
 * Distinct-array aggregation for the active dialect — the SQL idiom that
 * collapses a column from many rows into ONE array of its distinct values,
 * sorted for determinism. Backs the rollup `ARRAYUNIQUE` aggregation.
 *
 * - PostgreSQL: `ARRAY_AGG(DISTINCT <expr>::TEXT ORDER BY <expr>::TEXT)` — a
 *   native `text[]`.
 * - SQLite: `json_group_array(DISTINCT CAST(<expr> AS TEXT) ORDER BY CAST(...))`
 *   — SQLite has no array type, so the counterpart is TEXT holding a JSON
 *   array. `DISTINCT` and an in-aggregate `ORDER BY` are both accepted by the
 *   bundled SQLite (3.51; verified, not assumed — `DISTINCT` inside
 *   `json_group_array` is not universally available in older builds).
 *
 * WHY BOTH SIDES CAST TO TEXT. Not decoration — it is what makes the two
 * dialects answer the same thing, and it is what the surrounding code already
 * assumed. The empty-result default has always been `ARRAY[]::TEXT[]`, i.e.
 * this aggregate was ALREADY declared to be a text array; without the cast a
 * numeric source column produced `integer[]` and PostgreSQL refused to coalesce
 * the two (`COALESCE could not convert type text[] to integer[]`), so the
 * feature crashed at schema init on exactly the columns it did not cast.
 * SQLite's `json_group_array` has no such objection and would have emitted
 * `[5,7]` where PostgreSQL emitted nothing at all — trading a boot failure for
 * a silent per-dialect difference in ELEMENT type. Casting on both sides makes
 * the answer `['5','7']` on either engine, and matches the default that was
 * already there.
 *
 * The expression is interpolated unquoted; callers pass an already-validated
 * identifier reference (e.g. `alias.col`).
 */
export const distinctArrayAggExpression = (expression: string): string => {
  const castExpression = castToText(expression)
  if (isSqliteRuntime()) {
    return `json_group_array(DISTINCT ${castExpression} ORDER BY ${castExpression})`
  }
  return `ARRAY_AGG(DISTINCT ${castExpression} ORDER BY ${castExpression})`
}

/**
 * The empty value {@link distinctArrayAggExpression} degrades to when the
 * aggregate matched no rows — `ARRAY[]::TEXT[]` on PostgreSQL, the JSON literal
 * `'[]'` on SQLite.
 *
 * Kept beside the aggregate deliberately: they are one decision (what an empty
 * distinct-array is) expressed at two points in the same `COALESCE`, and the
 * SQLite half of this pair is the exact literal that used to abort schema
 * init with `near "[]": syntax error`.
 */
export const emptyArrayLiteral = (): string => (isSqliteRuntime() ? `'[]'` : `ARRAY[]::TEXT[]`)

/**
 * "This cell holds something" — the predicate behind the rollup `COUNTA`
 * aggregation, for a column of ANY type.
 *
 * Emits `<expr> IS NOT NULL AND <expr>::TEXT != ''` on PostgreSQL and
 * `... CAST(<expr> AS TEXT) != ''` on SQLite.
 *
 * WHY THE VALUE IS COMPARED AS TEXT. Emptiness is a TEXT notion, and the
 * predicate used to apply it to the raw column: `x != ''`. PostgreSQL will not
 * compare an integer to an empty string and aborts schema init with
 * `invalid input syntax for type integer: ""`, so `COUNTA` over any non-text
 * column killed the boot. SQLite compares across types instead of refusing, so
 * the SAME config quietly worked there — the two engines disagreed about
 * whether the config was valid at all, which is worse than a plain crash
 * because only one of them says so.
 *
 * Casting settles both. A text column behaves EXACTLY as before (the cast is an
 * identity there), and every other type gets the reading a human means by
 * "non-empty": `0`, `false` and a date all count; `NULL` and `''` do not.
 * Verified across text, integer, date and boolean on PostgreSQL 16 and the
 * bundled SQLite 3.51 — every pairing agrees, which is what makes it safe to
 * apply to all types rather than branching on the declared field type.
 *
 * WHAT WAS NOT DONE, and why. Dropping `!= ''` and keeping only `IS NOT NULL`
 * also stops the crash, and is wrong: it would silently redefine `COUNTA` for
 * text columns — empty strings would start counting — changing answers that
 * were never part of the failure.
 */
export const nonEmptyValuePredicate = (expression: string): string =>
  `${expression} IS NOT NULL AND ${castToText(expression)} != ''`
