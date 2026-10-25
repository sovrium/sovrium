/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quote } from './sqlite-to-postgres-copy-statements'
import type { PostgresTargetState } from '@/application/ports/services/backup-workspace'

/**
 * The PostgreSQL database a SQLite backup is restored into: whether it is
 * empty, and how to make it empty again when the restore fails.
 *
 * Both run on their own short-lived connection, never through the process-wide
 * `db` module: the restore process was started for SQLite or for nothing, and
 * the database layer is dialect-locked once it is first touched.
 *
 * "Empty" is the definition a cross-dialect restore can rely on: no table,
 * partitioned table, view, materialized view, sequence or foreign table in any
 * schema other than the catalogue's, ignoring every object an installed
 * extension owns. Installed extensions and empty schemas are accepted, so a
 * host that pre-installs `vector` (which the PostgreSQL migrations need) still
 * counts as empty.
 */

/** The relation kinds an empty database holds none of (`pg_class.relkind`). */
const RELATION_KINDS = "('r', 'p', 'v', 'm', 'S', 'f')"

/** Relations outside the catalogue that no extension owns. */
const USER_RELATIONS = `
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
 WHERE c.relkind IN ${RELATION_KINDS}
   AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
   AND ns.nspname NOT LIKE 'pg\\_toast%'
   AND NOT EXISTS (
     SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
   )`

/**
 * Inspect the target, read-only. A database that cannot be reached is a state,
 * not a failure: this never rejects.
 *
 * @total
 */
export const inspectPostgresTarget = async (databaseUrl: string): Promise<PostgresTargetState> => {
  const sql = (() => {
    try {
      return new Bun.SQL(databaseUrl, { max: 1, connectionTimeout: 10 })
    } catch {
      return undefined
    }
  })()
  if (sql === undefined) return { reachable: false }
  try {
    const rows = (await sql.unsafe(
      `SELECT ns.nspname AS schema, c.relname AS name
         ${USER_RELATIONS}
          AND NOT EXISTS (
            SELECT 1 FROM pg_depend owned
             WHERE owned.classid = 'pg_class'::regclass AND owned.objid = c.oid
               AND owned.refclassid = 'pg_class'::regclass AND owned.deptype IN ('a', 'i')
               AND c.relkind = 'S'
          )
        ORDER BY (c.relkind NOT IN ('r', 'p')), ns.nspname, c.relname`
    )) as readonly { readonly schema: string; readonly name: string }[]
    const schemas = (await sql.unsafe(
      `SELECT nspname AS name FROM pg_namespace WHERE nspname IN ('auth', 'system', 'drizzle') ORDER BY 1`
    )) as readonly { readonly name: string }[]
    return {
      reachable: true,
      relations: rows.map((row) => `${row.schema}.${row.name}`),
      preExistingSchemas: schemas.map((schema) => schema.name),
    }
  } catch {
    return { reachable: false }
  } finally {
    await sql.close().catch(() => undefined)
  }
}

const DROP_KEYWORD: Readonly<Record<string, string>> = {
  r: 'TABLE',
  p: 'TABLE',
  v: 'VIEW',
  m: 'MATERIALIZED VIEW',
  S: 'SEQUENCE',
  f: 'FOREIGN TABLE',
}

/** The schemas the engine's migrations create. */
const ENGINE_SCHEMAS = ['auth', 'system', 'drizzle'] as const

/**
 * Return a database the restore built into to the empty state it started in,
 * touching only what the restore created.
 *
 * - An engine schema (`auth`, `system`, `drizzle`) is dropped only when it did
 *   not exist before the restore (`preExistingSchemas`, recorded by the
 *   emptiness check). A host commonly ships an `auth` schema of its own,
 *   holding functions; it survives.
 * - Relations are swept only in `public` and in the engine schemas that
 *   already existed — the database held none there before the restore, by
 *   the emptiness check, so every one is the restore's — and never one an
 *   extension owns.
 * - Every statement runs under a transaction-local `lock_timeout`, so a lock
 *   someone else holds fails the cleanup instead of hanging it.
 *
 * Rejects when the database cannot be emptied; the caller then tells the
 * operator to recreate it.
 */
export const dropRestoredObjects = async (
  databaseUrl: string,
  preExistingSchemas: readonly string[]
): Promise<void> => {
  const created = ENGINE_SCHEMAS.filter((schema) => !preExistingSchemas.includes(schema))
  const swept = [
    'public',
    ...ENGINE_SCHEMAS.filter((schema) => preExistingSchemas.includes(schema)),
  ]
  const sql = new Bun.SQL(databaseUrl, { max: 1, connectionTimeout: 10 })
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL lock_timeout = '5s'")
      if (created.length > 0) {
        await tx.unsafe(`DROP SCHEMA IF EXISTS ${created.map(quote).join(', ')} CASCADE`)
      }
      const rows = (await tx.unsafe(
        `SELECT ns.nspname AS schema, c.relname AS name, c.relkind::text AS kind
           ${USER_RELATIONS}
            AND ns.nspname = ANY($1::text::text[])
          ORDER BY (c.relkind NOT IN ('r', 'p')), ns.nspname, c.relname`,
        [`{${swept.join(',')}}`]
      )) as readonly { readonly schema: string; readonly name: string; readonly kind: string }[]
      for (const row of rows) {
        await tx.unsafe(
          `DROP ${DROP_KEYWORD[row.kind] ?? 'TABLE'} IF EXISTS ${quote(row.schema)}.${quote(row.name)} CASCADE`
        )
      }
    })
  } finally {
    await sql.close().catch(() => undefined)
  }
}
