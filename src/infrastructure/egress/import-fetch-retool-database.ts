/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Retool Database fetcher: a PostgreSQL database, read over the
 * connection URL Retool shows its admins (pinned under
 * `[internal ref]`).
 *
 * - **The URL is a secret.** It is read from the environment by the caller,
 *   handed in here, used to open ONE connection, and written nowhere: not to
 *   the snapshot, not to an error (a driver error is replaced by a fixed
 *   message, because a driver may quote its connection string).
 * - **Read-only, twice over.** The connection runs one transaction opened
 *   `READ ONLY` at `REPEATABLE READ`, so every page reads the same snapshot of
 *   the data, and the transaction is rolled back, never committed. Nothing the
 *   fetch sends can write, whatever the role's grants.
 * - **The catalogue, then the rows.** Four `information_schema` reads give the
 *   tables, columns, types, primary keys, foreign keys and unique
 *   constraints; each table's rows are then read 1,000 at a time as
 *   `row_to_json`, in key order. Never `pg_dump`: it is version-coupled to the
 *   server, and Retool does not document it.
 * - **Identifiers are quoted by the driver** (`sql(name)`), never spliced in;
 *   values are bound.
 *
 * A connection is a resource with a lifetime: it is acquired in a scope and
 * released on every exit, success, failure or interruption.
 */

import { SQL } from 'bun'
import { Effect, type Scope } from 'effect'
import {
  RETOOL_SCHEMA_PATHS,
  retoolRowsPath,
  retoolTablesOf,
  type RetoolTableRef,
} from '@/domain/models/import/retool-database-adapter-service'
import { ImportFetchError } from './import-fetch-client'
import type { FetchSummary, SnapshotSink } from './import-fetch-sink'

/** Rows per page. */
const PAGE_SIZE = 1000

/** Seconds a statement may run before the server cancels it. */
const STATEMENT_TIMEOUT = '60s'

/** The schemas that hold PostgreSQL's own catalogue, never the operator's tables. */
const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema'] as const

/** What the Retool fetcher is handed. */
export interface PostgresFetchContext {
  readonly sink: SnapshotSink
  readonly domains: readonly string[]
}

/** A failure that never carries the driver's own words, which may quote the URL. */
const failed = (what: string, resumable: boolean) =>
  new ImportFetchError({ message: `the database ${what}`, resumable })

/** One connection, inside one read-only transaction, rolled back and closed on release. */
const acquireReadOnly = (url: string): Effect.Effect<SQL, ImportFetchError, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const client = new SQL({ url, max: 1, connectionTimeout: 30 })
        await client.unsafe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        await client.unsafe(
          `SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT}'; SET LOCAL TimeZone = 'UTC'`
        )
        return client
      },
      catch: () => failed('could not be opened read-only with the URL given', false),
    }),
    (client) =>
      // effect-promise: total -- the rollback's failure (a connection already gone) is swallowed by its own `.catch`, and `SQL.close()` has no rejection path; the RELEASE arm must stay infallible so a teardown never displaces the fetch's outcome.
      Effect.promise(async () => {
        await client.unsafe('ROLLBACK').catch(() => undefined)
        await client.close()
      })
  )

const query = <A>(what: string, run: () => Promise<A>): Effect.Effect<A, ImportFetchError> =>
  Effect.tryPromise({ try: run, catch: () => failed(`refused to read ${what}`, true) })

const bytesOf = (value: unknown): Uint8Array =>
  new TextEncoder().encode(`${JSON.stringify(value, undefined, 2)}\n`)

type Row = Readonly<Record<string, unknown>>

/** What the catalogue reads return, for the row reads that follow. */
interface Catalogue {
  readonly columns: readonly Row[]
  readonly constraints: readonly Row[]
  readonly keys: readonly Row[]
}

/** The four catalogue reads, each written as the rows the driver returned. */
const fetchCatalogue = (sql: SQL, sink: SnapshotSink): Effect.Effect<Catalogue, ImportFetchError> =>
  Effect.gen(function* () {
    const system = sql([...SYSTEM_SCHEMAS])
    const columns = yield* query('the columns', () =>
      sql`SELECT c.table_schema, c.table_name, c.column_name, c.ordinal_position, c.column_default,
            c.is_nullable, c.data_type, c.character_maximum_length, c.numeric_precision,
            c.numeric_scale, c.udt_name, c.is_identity, c.is_generated
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name
          WHERE t.table_type = 'BASE TABLE' AND c.table_schema NOT IN ${system}
            AND c.table_schema NOT LIKE 'pg\\_%'
          ORDER BY c.table_schema, c.table_name, c.ordinal_position`.then(
        (rows: readonly Row[]) => [...rows]
      )
    )
    const constraints = yield* query('the constraints', () =>
      sql`SELECT constraint_schema, constraint_name, table_schema, table_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_schema NOT IN ${system} AND constraint_type <> 'CHECK'
          ORDER BY table_schema, table_name, constraint_name`.then((rows: readonly Row[]) => [
        ...rows,
      ])
    )
    const keys = yield* query('the key columns', () =>
      sql`SELECT constraint_schema, constraint_name, table_schema, table_name, column_name,
            ordinal_position, position_in_unique_constraint
          FROM information_schema.key_column_usage
          WHERE table_schema NOT IN ${system}
          ORDER BY table_schema, table_name, constraint_name, ordinal_position`.then(
        (rows: readonly Row[]) => [...rows]
      )
    )
    const references = yield* query('the referenced columns', () =>
      sql`SELECT constraint_schema, constraint_name, table_schema, table_name, column_name
          FROM information_schema.constraint_column_usage
          WHERE constraint_schema NOT IN ${system}
          ORDER BY constraint_schema, constraint_name, table_schema, table_name, column_name`.then(
        (rows: readonly Row[]) => [...rows]
      )
    )
    yield* sink.writeRaw(RETOOL_SCHEMA_PATHS.columns, bytesOf(columns))
    yield* sink.writeRaw(RETOOL_SCHEMA_PATHS.tableConstraints, bytesOf(constraints))
    yield* sink.writeRaw(RETOOL_SCHEMA_PATHS.keyColumnUsage, bytesOf(keys))
    yield* sink.writeRaw(RETOOL_SCHEMA_PATHS.constraintColumnUsage, bytesOf(references))
    return { columns, constraints, keys }
  })

/** The primary key columns of a table, in key order, from the catalogue just read. */
const primaryKeyOf = (catalogue: Catalogue, ref: RetoolTableRef): readonly string[] => {
  const primary = catalogue.constraints.find(
    (row) =>
      row['table_schema'] === ref.schema &&
      row['table_name'] === ref.table &&
      row['constraint_type'] === 'PRIMARY KEY'
  )
  if (primary === undefined) return []
  return catalogue.keys
    .filter(
      (row) =>
        row['constraint_name'] === primary['constraint_name'] &&
        row['table_schema'] === ref.schema &&
        row['table_name'] === ref.table
    )
    .map((row) => String(row['column_name']))
}

/** `ORDER BY` the key, or the whole row when the table has none: every page the same order. */
const orderOf = (sql: SQL, key: readonly string[]) =>
  key.length === 0
    ? sql`row_to_json(t)::text`
    : key
        .slice(1)
        .reduce((order, column) => sql`${order}, ${sql(column)}`, sql`${sql(key[0] ?? '')}`)

/** Every rows page of one table, from where a previous run stopped. */
const fetchRows = (
  sql: SQL,
  sink: SnapshotSink,
  table: { readonly ref: RetoolTableRef; readonly index: number; readonly key: readonly string[] }
): Effect.Effect<void, ImportFetchError> => {
  const resource = `tables/${String(table.index + 1).padStart(4, '0')}/rows`
  const previous = sink.cursorOf(resource)
  if (previous?.complete === true) return Effect.void
  const qualified = sql(`${table.ref.schema}.${table.ref.table}`)
  const step = (pages: number): Effect.Effect<void, ImportFetchError> =>
    query(`the rows of ${table.ref.table}`, () =>
      sql`SELECT row_to_json(t)::text AS row FROM ${qualified} t
          ORDER BY ${orderOf(sql, table.key)}
          LIMIT ${PAGE_SIZE} OFFSET ${pages * PAGE_SIZE}`.then((rows) =>
        [...rows].map((row: Row) => String(row['row']))
      )
    ).pipe(
      Effect.tap((rows) =>
        sink.writeRaw(
          retoolRowsPath(table.index, pages + 1),
          new TextEncoder().encode(`{"rows":[${rows.join(',\n')}]}\n`)
        )
      ),
      Effect.flatMap((rows) => {
        const more = rows.length === PAGE_SIZE
        return sink
          .saveCursor({
            resource,
            pages: pages + 1,
            complete: !more,
            ...(more ? { cursor: String((pages + 1) * PAGE_SIZE) } : {}),
          })
          .pipe(Effect.flatMap(() => (more ? step(pages + 1) : Effect.void)))
      })
    )
  return step(previous?.pages ?? 0)
}

/** Fetch a Retool Database (any PostgreSQL database) into the snapshot. */
export const fetchRetoolDatabase = (
  url: string,
  context: PostgresFetchContext
): Effect.Effect<FetchSummary, ImportFetchError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const sql = yield* acquireReadOnly(url)
      const catalogue = yield* fetchCatalogue(sql, context.sink)
      const refs = retoolTablesOf(catalogue.columns)
      if (context.domains.includes('data')) {
        yield* Effect.forEach(
          refs,
          (ref, index) =>
            fetchRows(sql, context.sink, { ref, index, key: primaryKeyOf(catalogue, ref) }),
          { discard: true }
        )
      }
      return { ids: refs.map((ref) => `${ref.schema}.${ref.table}`) }
    })
  ).pipe(Effect.withSpan('import.fetch-retool-database'))
