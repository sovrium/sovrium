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

/** The schemas the engine's migrations create. */
const ENGINE_SCHEMAS = ['auth', 'system', 'drizzle'] as const

/** `public` and the engine schemas that already existed: where a cleanup sweeps object by object. */
const sweptSchemas = (preExistingSchemas: readonly string[]): readonly string[] => [
  'public',
  ...ENGINE_SCHEMAS.filter((schema) => preExistingSchemas.includes(schema)),
]

/**
 * Routines (functions, procedures, aggregates) no extension owns, in the
 * schemas `$1` names, each with the signature a `DROP` names it by — the same
 * text on both sides, so a snapshot and a later sweep compare by equality.
 */
const USER_ROUTINES = `
     , kind
  FROM (
    SELECT format('%I.%I(%s)', ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
             AS signature,
           p.prokind::text AS kind
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = ANY($1::text::text[])
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
       )
  ) routines
 ORDER BY signature`

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
    const preExistingSchemas = schemas.map((schema) => schema.name)
    const routines = (await sql.unsafe(`SELECT signature ${USER_ROUTINES}`, [
      `{${sweptSchemas(preExistingSchemas).join(',')}}`,
    ])) as readonly { readonly signature: string }[]
    return {
      reachable: true,
      relations: rows.map((row) => `${row.schema}.${row.name}`),
      preExistingSchemas,
      preExistingRoutines: routines.map((routine) => routine.signature),
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
 * - Routines (the per-table trigger functions the schema build writes in
 *   `public`, for one) are swept in the same schemas, but only those absent
 *   from the snapshot the emptiness check took (`preExistingRoutines`): a
 *   function the database's owner wrote before the restore is kept.
 * - Every statement runs under a transaction-local `lock_timeout`, so a lock
 *   someone else holds fails the cleanup instead of hanging it.
 *
 * Rejects when the database cannot be emptied; the caller then tells the
 * operator to recreate it.
 */
export const dropRestoredObjects = async (
  databaseUrl: string,
  preExistingSchemas: readonly string[],
  preExistingRoutines: readonly string[]
): Promise<void> => {
  const created = ENGINE_SCHEMAS.filter((schema) => !preExistingSchemas.includes(schema))
  const swept = sweptSchemas(preExistingSchemas)
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
      // After the relations: the triggers that used these functions are gone with their tables.
      const routines = (await tx.unsafe(`SELECT signature ${USER_ROUTINES}`, [
        `{${swept.join(',')}}`,
      ])) as readonly { readonly signature: string; readonly kind: string }[]
      const kept = new Set(preExistingRoutines)
      for (const routine of routines.filter(({ signature }) => !kept.has(signature))) {
        await tx.unsafe(
          `DROP ${routine.kind === 'a' ? 'AGGREGATE' : 'ROUTINE'} IF EXISTS ${routine.signature}`
        )
      }
    })
  } finally {
    await sql.close().catch(() => undefined)
  }
}

/** The `DROP` keyword of each relation kind, as the replace script writes it in SQL. */
const RELATION_DROP_KEYWORD = `CASE c.relkind
           WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' WHEN 'S' THEN 'SEQUENCE'
           WHEN 'f' THEN 'FOREIGN TABLE' ELSE 'TABLE' END`

/**
 * The SQL `sovrium restore --force` runs before a PostgreSQL dump, in the
 * replay's own transaction: a replay that fails rolls this back with it.
 *
 * It removes what a dump of the app recreates, and nothing else:
 *
 * - the engine schemas (`auth`, `drizzle`, `system`), whole;
 * - in `public`, every relation, routine and type (enum, domain, range,
 *   standalone composite) that no installed extension owns. A routine that
 *   is part of another object (a range type's constructor) goes with it. The `public`
 *   schema itself stays, and with it an extension such as `vector`.
 *
 * Every other schema — another tool's beside the app — is kept: it does not
 * conflict with the dump, and if it did, the replay would fail and roll back.
 * Relations go first, then routines (the trigger functions their tables
 * used), then types, each `IF EXISTS … CASCADE` since an earlier drop may
 * already have taken a later object with it.
 */
export const REPLACE_APP_OBJECTS_SQL = `DROP SCHEMA IF EXISTS auth, drizzle, system CASCADE;
DO $sovrium_replace$
DECLARE
  statement text;
BEGIN
  FOR statement IN
    SELECT format('DROP %s IF EXISTS %I.%I CASCADE', ${RELATION_DROP_KEYWORD}, ns.nspname, c.relname)
      ${USER_RELATIONS}
       AND ns.nspname = 'public'
     ORDER BY (c.relkind NOT IN ('r', 'p')), c.relname
  LOOP
    EXECUTE statement;
  END LOOP;
  FOR statement IN
    SELECT format('DROP %s IF EXISTS %I.%I(%s) CASCADE',
             CASE p.prokind WHEN 'a' THEN 'AGGREGATE' ELSE 'ROUTINE' END,
             ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype IN ('e', 'i')
       )
  LOOP
    EXECUTE statement;
  END LOOP;
  FOR statement IN
    SELECT format('DROP %s IF EXISTS %I.%I CASCADE',
             CASE t.typtype WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END, ns.nspname, t.typname)
      FROM pg_type t
      JOIN pg_namespace ns ON ns.oid = t.typnamespace
      LEFT JOIN pg_class composite ON composite.oid = t.typrelid
     WHERE ns.nspname = 'public'
       AND (t.typtype IN ('e', 'd', 'r') OR (t.typtype = 'c' AND composite.relkind = 'c'))
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e'
       )
  LOOP
    EXECUTE statement;
  END LOOP;
END
$sovrium_replace$;
`

/** A dump preceded by {@link REPLACE_APP_OBJECTS_SQL}: the script a forced replay feeds `psql`. */
export const withAppObjectsReplaced = (dump: Uint8Array): Uint8Array => {
  const preamble = new TextEncoder().encode(REPLACE_APP_OBJECTS_SQL)
  const script = new Uint8Array(preamble.byteLength + dump.byteLength)
  script.set(preamble, 0)
  script.set(dump, preamble.byteLength)
  return script
}
