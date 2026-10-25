/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Database } from 'bun:sqlite'
import {
  SqliteToPostgresCopyError,
  convertRow,
  insertStatement,
  label,
  planColumns,
  qualified,
  quote,
  selectStatement,
  type SourceColumn,
  type Sql,
  type TargetColumn,
} from './sqlite-to-postgres-copy-statements'
import { planTableCopies, type TableCopy } from './sqlite-to-postgres-table-map'
import { loadUploadsIntoDatabase } from './sqlite-to-postgres-uploads'

/**
 * Copy every row of a SQLite database into a PostgreSQL database whose schema
 * was just built from the same config, in ONE transaction.
 *
 * Both connections are private to this call — `bun:sqlite` read-only on the
 * scratch copy, and a dedicated one-connection `Bun.SQL` pool — never the
 * process-wide `db` module, which is dialect-locked.
 *
 * ### Inside the transaction, in order
 *
 * 1. The session time zone is UTC, so no instant shifts with the server's zone.
 * 2. Every foreign key on a copied table is recorded with
 *    `pg_get_constraintdef` and dropped, and user triggers are disabled: the
 *    copy inserts in any table order, a self-reference needs no ordering, and
 *    the copy itself writes no activity, no webhook delivery, no automation run
 *    and rewrites no `updated_at`. Table-owner privilege suffices; no
 *    `session_replication_role`, which needs a superuser.
 * 3. Each table is copied by column NAME, each value converted by the target
 *    column's type ({@link convertSqliteCell}); generated columns (the search
 *    documents) are left for PostgreSQL to derive from the copied text.
 * 4. Every serial or identity column's sequence continues past the highest
 *    number ever issued: the column's highest value, or for a SQLite
 *    `AUTOINCREMENT` key its `sqlite_sequence` entry when that is higher, so an
 *    id that belonged to a deleted row is never issued again.
 * 4b. When the restored server keeps uploads in the database, the archive's
 *    files are loaded beside their file records (`sqlite-to-postgres-uploads.ts`).
 * 5. The foreign keys are re-created from their recorded definitions — which
 *    validates every reference once — and the triggers re-enabled.
 *
 * Any failure rolls the whole copy back and rejects with a
 * {@link SqliteToPostgresCopyError} naming the table, and the column and row
 * when the fault is one value.
 */

/** How many rows went into one PostgreSQL table. */
export interface CopiedTable {
  readonly table: string
  readonly rows: number
}

/** Bun.SQL refuses more than 65,535 bound parameters per statement. */
const MAX_PARAMETERS = 60_000
const MAX_BATCH_ROWS = 500

const sqliteTableNames = (sqlite: Database): readonly string[] =>
  sqlite
    .query<{ readonly name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name"
    )
    .all()
    .map((row) => row.name)

const sqliteColumns = (sqlite: Database, table: string): readonly SourceColumn[] =>
  sqlite.query<SourceColumn, []>(`PRAGMA table_info(${quote(table)})`).all()

/** The highest id SQLite ever issued for a table, deleted rows included. */
const sqliteSequenceOf = (sqlite: Database, table: string): bigint => {
  const hasSequence = sqlite
    .query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'")
    .get()
  if (hasSequence === null) return 0n
  const row = sqlite
    .query<{ readonly seq: bigint | number }, [string]>(
      'SELECT seq FROM sqlite_sequence WHERE name = ?'
    )
    .get(table)
  return row === null ? 0n : BigInt(row.seq)
}

const readTargetTables = async (sql: Sql): Promise<ReadonlySet<string>> => {
  const rows = (await sql.unsafe(
    `SELECT table_schema AS schema, table_name AS name
       FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')`
  )) as readonly { readonly schema: string; readonly name: string }[]
  return new Set(rows.map((row) => `${row.schema}.${row.name}`))
}

const readTargetColumns = async (sql: Sql, copy: TableCopy): Promise<readonly TargetColumn[]> =>
  (await sql.unsafe(
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS "notNull",
            (a.atthasdef OR a.attidentity <> '') AS "hasDefault",
            (a.attgenerated <> '') AS generated
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [copy.schema, copy.table]
  )) as readonly TargetColumn[]

/** Rethrow a PostgreSQL error raised while writing `copy` as a copy error naming it. */
const asCopyError = (copy: TableCopy, error: unknown): SqliteToPostgresCopyError => {
  if (error instanceof SqliteToPostgresCopyError) return error
  const detail = (error as { readonly detail?: unknown } | null)?.detail
  const message = error instanceof Error ? error.message : String(error)
  const column = (error as { readonly column?: unknown } | null)?.column
  return new SqliteToPostgresCopyError(
    label(copy),
    typeof detail === 'string' && detail.length > 0 ? `${message} (${detail})` : message,
    typeof column === 'string' && column.length > 0 ? column : undefined
  )
}

const copyTable = async (
  tx: Sql,
  sqlite: Database,
  copy: TableCopy,
  signal: AbortSignal | undefined
): Promise<CopiedTable> => {
  const occupied = (await tx.unsafe(
    `SELECT 1 FROM ${qualified(copy)} LIMIT 1`
  )) as readonly unknown[]
  if (occupied.length > 0) {
    throw new SqliteToPostgresCopyError(label(copy), 'the table already holds rows in PostgreSQL')
  }
  const source = sqliteColumns(sqlite, copy.source)
  const columns = planColumns(copy, source, await readTargetColumns(tx, copy))
  if (columns.length === 0) return { table: label(copy), rows: 0 }
  const idColumn = source.some((column) => column.name === 'id') ? '"id"' : 'rowid'
  const batchRows = Math.max(
    1,
    Math.min(MAX_BATCH_ROWS, Math.floor(MAX_PARAMETERS / columns.length))
  )
  const statement = sqlite.query<Record<string, unknown>, []>(
    selectStatement(copy.source, columns, idColumn)
  )
  // Filled in place: re-spreading the batch per row would copy it quadratically.
  const batch = Array.from<readonly (string | Uint8Array | null)[]>({ length: batchRows })
  let size = 0
  let copied = 0
  const flush = async () => {
    // An interrupted restore stops here, between batches; the throw rolls the copy back.
    signal?.throwIfAborted()
    if (size === 0) return
    await tx.unsafe(insertStatement(copy, columns, size), batch.slice(0, size).flat())
    copied += size
    size = 0
  }
  for (const row of statement.iterate()) {
    batch[size] = convertRow(copy, columns, row)
    size += 1
    if (size >= batchRows) await flush()
  }
  await flush()
  return { table: label(copy), rows: copied }
}

/** Whether `column` is the source table's single INTEGER primary key — its `AUTOINCREMENT` id. */
const isSqliteIntegerKey = (source: readonly SourceColumn[], column: string): boolean => {
  const key = source.filter((candidate) => candidate.pk > 0)
  return key.length === 1 && key[0]?.name === column && key[0].type.toUpperCase() === 'INTEGER'
}

/** Move every serial and identity sequence of `copy` past the highest number ever issued. */
const continueSequences = async (tx: Sql, sqlite: Database, copy: TableCopy): Promise<void> => {
  const sequences = (await tx.unsafe(
    `SELECT column_name AS "column", pg_get_serial_sequence($1, column_name) AS sequence
       FROM information_schema.columns
      WHERE table_schema = $2 AND table_name = $3`,
    [qualified(copy), copy.schema, copy.table]
  )) as readonly { readonly column: string; readonly sequence: string | null }[]
  const source = sqliteColumns(sqlite, copy.source)
  for (const { column, sequence } of sequences) {
    if (sequence === null) continue
    const [highest] = (await tx.unsafe(
      `SELECT COALESCE(MAX(${quote(column)}), 0)::text AS n FROM ${qualified(copy)}`
    )) as readonly { readonly n: string }[]
    const issued = isSqliteIntegerKey(source, column) ? sqliteSequenceOf(sqlite, copy.source) : 0n
    const stored = BigInt(highest?.n ?? '0')
    const next = stored > issued ? stored : issued
    if (next > 0n) {
      await tx.unsafe('SELECT setval($1, $2::text::bigint, true)', [sequence, next.toString()])
    }
  }
}

interface ForeignKey {
  readonly schema: string
  readonly table: string
  readonly name: string
  readonly definition: string
}

const readForeignKeys = async (
  tx: Sql,
  copies: readonly TableCopy[]
): Promise<readonly ForeignKey[]> => {
  const copied = new Set(copies.map((copy) => `${copy.schema}.${copy.table}`))
  const rows = (await tx.unsafe(
    `SELECT ns.nspname AS schema, c.relname AS "table", con.conname AS name,
            pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE con.contype = 'f'
      ORDER BY 1, 2, 3`
  )) as readonly ForeignKey[]
  return rows.filter((row) => copied.has(`${row.schema}.${row.table}`))
}

const tableOf = (key: ForeignKey): TableCopy => ({
  source: '',
  schema: key.schema,
  table: key.table,
})

/** Copy every table and continue its sequences, naming the table a failure stopped at. */
const copyTables = async (
  tx: Sql,
  sqlite: Database,
  copies: readonly TableCopy[],
  signal: AbortSignal | undefined
): Promise<readonly CopiedTable[]> => {
  let copied: readonly CopiedTable[] = []
  for (const copy of copies) {
    try {
      copied = [...copied, await copyTable(tx, sqlite, copy, signal)]
      await continueSequences(tx, sqlite, copy)
    } catch (error) {
      throw asCopyError(copy, error)
    }
  }
  return copied
}

/** Re-create the recorded foreign keys: PostgreSQL validates every copied reference here. */
const restoreForeignKeys = async (tx: Sql, foreignKeys: readonly ForeignKey[]): Promise<void> => {
  for (const key of foreignKeys) {
    try {
      await tx.unsafe(
        `ALTER TABLE ${qualified(tableOf(key))} ADD CONSTRAINT ${quote(key.name)} ${key.definition}`
      )
    } catch (error) {
      throw asCopyError(tableOf(key), error)
    }
  }
}

/** Steps 1 to 5 of the module documentation, inside the copy's one transaction. */
const copyInTransaction = async (
  tx: Sql,
  sqlite: Database,
  copies: readonly TableCopy[],
  options: { readonly uploads?: ReadonlyMap<string, Uint8Array>; readonly signal?: AbortSignal }
): Promise<readonly CopiedTable[]> => {
  await tx.unsafe("SET LOCAL TimeZone = 'UTC'")
  const foreignKeys = await readForeignKeys(tx, copies)
  for (const key of foreignKeys) {
    await tx.unsafe(`ALTER TABLE ${qualified(tableOf(key))} DROP CONSTRAINT ${quote(key.name)}`)
  }
  for (const copy of copies) {
    await tx.unsafe(`ALTER TABLE ${qualified(copy)} DISABLE TRIGGER USER`)
  }
  const copied = await copyTables(tx, sqlite, copies, options.signal)
  if (options.uploads !== undefined) await loadUploadsIntoDatabase(tx, options.uploads)
  options.signal?.throwIfAborted()
  await restoreForeignKeys(tx, foreignKeys)
  for (const copy of copies) {
    await tx.unsafe(`ALTER TABLE ${qualified(copy)} ENABLE TRIGGER USER`)
  }
  return copied
}

/**
 * Copy the SQLite database at `sqlitePath` into the PostgreSQL database at
 * `databaseUrl`. Resolves with the rows copied per table; rejects with a
 * {@link SqliteToPostgresCopyError}, the transaction rolled back.
 */
export const copySqliteIntoPostgres = async (
  sqlitePath: string,
  databaseUrl: string,
  uploads: ReadonlyMap<string, Uint8Array> | undefined = undefined,
  signal: AbortSignal | undefined = undefined
): Promise<readonly CopiedTable[]> => {
  const sqlite = new Database(sqlitePath, { readonly: true, safeIntegers: true })
  const sql = new Bun.SQL(databaseUrl, { max: 1, connectionTimeout: 10 })
  try {
    const plan = planTableCopies(sqliteTableNames(sqlite), await readTargetTables(sql))
    const [unmapped] = plan.unmapped
    if (unmapped !== undefined) {
      throw new SqliteToPostgresCopyError(
        unmapped,
        'the table has no counterpart in the PostgreSQL schema'
      )
    }
    return await sql.begin((tx) =>
      copyInTransaction(tx, sqlite, plan.copies, {
        ...(uploads === undefined ? {} : { uploads }),
        ...(signal === undefined ? {} : { signal }),
      })
    )
  } finally {
    sqlite.close()
    await sql.close().catch(() => undefined)
  }
}
