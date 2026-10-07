/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether the lookup, rollup and count views installed in the database are the
 * ones THIS binary would generate for the config.
 *
 * A view-backed table's view is derived: the engine writes its SQL from the
 * config, and a fix to that SQL — a masked value, a trashed record left out of
 * a lookup — is a new definition for the SAME config. The schema checksum
 * hashes the config alone, so a deployment that upgrades the binary without
 * editing its config would otherwise keep the old view forever. The checksum
 * fast path asks this module first, and a stale definition sends the boot down
 * the full migration, which rebuilds every view (and SQLite's `INSTEAD OF`
 * triggers).
 *
 * The comparison is against the INSTALLED definition, not a stored stamp, so a
 * view replaced by hand is caught too:
 *
 *   - **SQLite** keeps the text of each `CREATE VIEW` / `CREATE TRIGGER` in
 *     `sqlite_master.sql`, so the generated statement is compared as text
 *     (whitespace-insensitive).
 *   - **PostgreSQL** keeps a parsed rule, not the text, and
 *     `pg_get_viewdef` deparses it in its own form. The generated statement is
 *     therefore created as a TEMPORARY view on the same connection, and the two
 *     deparsed definitions are compared — the same parser on both sides. The
 *     view's `INSTEAD OF` trigger functions are compared too (`pg_proc.prosrc`
 *     keeps a body verbatim), and each trigger must still be on its view: a
 *     binary can change how a write through the view is redirected without
 *     changing the view.
 *
 * Creating the probe needs the `TEMP` privilege on the database; a role
 * without it cannot compare, and the caller then declines the fast path.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  generateLookupViewSQL,
  generateLookupViewTriggers,
  shouldUseView,
} from '@/infrastructure/database/lookup/lookup-view-generators'
import { sortTablesByDependencies } from './schema-dependency-sorting'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'

/** One object the engine installs for a view-backed table, with its generated DDL. */
export interface GeneratedViewObject {
  /**
   * `function` is PostgreSQL's `INSTEAD OF` trigger function, whose `sql` is
   * its body (the text between the `$$` quotes, which `pg_proc.prosrc` keeps
   * verbatim); a PostgreSQL `trigger` is compared by presence on its view.
   */
  readonly kind: 'view' | 'trigger' | 'function'
  readonly name: string
  readonly sql: string
  /** The view a PostgreSQL trigger is attached to. */
  readonly on?: string
}

/** The name the probe view takes on PostgreSQL; temporary, and dropped after each use. */
const PROBE_VIEW = 'sovrium_view_definition_probe'

/** A statement's `CREATE TRIGGER <name>`, or `undefined` for any other statement. */
const triggerNameOf = (statement: string): string | undefined =>
  /^\s*CREATE\s+TRIGGER\s+(\S+)/i.exec(statement)?.[1]

/** A PostgreSQL `CREATE OR REPLACE FUNCTION <name>() … AS $$<body>$$`, as its name and body. */
export const triggerFunctionOf = (
  statement: string
): { readonly name: string; readonly body: string } | undefined => {
  const match =
    /^\s*CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-z0-9_]+)\(\)[\s\S]*?\$\$([\s\S]*)\$\$/i.exec(
      statement
    )
  return match?.[1] === undefined || match[2] === undefined
    ? undefined
    : { name: match[1], body: match[2] }
}

/** The `INSTEAD OF` objects of one view: SQLite's triggers, or PostgreSQL's functions and triggers. */
const triggerObjectsOf = (
  table: Table,
  viewName: string,
  dialect: 'postgres' | 'sqlite'
): readonly GeneratedViewObject[] =>
  generateLookupViewTriggers(table).flatMap((statement): readonly GeneratedViewObject[] => {
    const trigger = triggerNameOf(statement)
    if (trigger !== undefined) {
      return [
        dialect === 'sqlite'
          ? { kind: 'trigger', name: trigger, sql: statement }
          : { kind: 'trigger', name: trigger, sql: statement, on: viewName },
      ]
    }
    const fn = dialect === 'postgres' ? triggerFunctionOf(statement) : undefined
    return fn === undefined ? [] : [{ kind: 'function', name: fn.name, sql: fn.body }]
  })

/**
 * Every view and every `INSTEAD OF` trigger (PostgreSQL: and its function) the
 * migration would install, generated exactly as the migration generates them:
 * each view over the dependency-sorted table list the migration passes.
 */
export const generatedViewObjects = (
  tables: readonly Table[],
  dialect: 'postgres' | 'sqlite'
): readonly GeneratedViewObject[] => {
  const allTables = sortTablesByDependencies(tables)
  return allTables
    .filter((table) => shouldUseView(table))
    .flatMap((table): readonly GeneratedViewObject[] => {
      const name = sanitizeTableName(table.name)
      const view: GeneratedViewObject = {
        kind: 'view',
        name,
        sql: generateLookupViewSQL(table, allTables),
      }
      return [view, ...triggerObjectsOf(table, name, dialect)]
    })
}

/**
 * A statement as SQLite would compare it: surrounding whitespace, a trailing
 * semicolon and whitespace runs folded, and the leading keywords (which
 * `sqlite_master` may re-case) upper-cased.
 */
export const canonicalSqliteDefinition = (sql: string): string =>
  sql
    .trim()
    .replace(/;+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^create (view|trigger) /i, (prefix) => prefix.toUpperCase())

/** The first SQLite view or trigger whose installed text is not the generated one. */
const staleSqliteObject = async (
  tx: TransactionLike,
  expected: readonly GeneratedViewObject[]
): Promise<string | undefined> => {
  const rows = (await tx.unsafe(
    `SELECT type, name, sql FROM sqlite_master WHERE type IN ('view', 'trigger')`
  )) as readonly { readonly type: string; readonly name: string; readonly sql: string | null }[]
  const installed = new Map(rows.map((row) => [`${row.type}:${row.name}`, row.sql ?? '']))
  return expected.find((object) => {
    const current = installed.get(`${object.kind}:${object.name}`)
    return (
      current === undefined ||
      canonicalSqliteDefinition(current) !== canonicalSqliteDefinition(object.sql)
    )
  })?.name
}

/**
 * The generated `CREATE [OR REPLACE] VIEW <name> AS …` rewritten to create the
 * temporary probe instead, or `undefined` when the statement has another shape.
 */
export const probeStatementOf = (sql: string): string | undefined => {
  const rewritten = sql.replace(
    /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+\S+\s+AS\b/i,
    `CREATE TEMPORARY VIEW ${PROBE_VIEW} AS`
  )
  return rewritten === sql ? undefined : rewritten
}

/** Whether one PostgreSQL view's installed definition deparses as the generated one. */
const postgresViewMatches = async (
  tx: TransactionLike,
  view: GeneratedViewObject
): Promise<boolean> => {
  const probe = probeStatementOf(view.sql)
  if (probe === undefined) return false
  await tx.unsafe(probe)
  try {
    // Both names are quoted (S3), and the probe is addressed in `pg_temp`
    // explicitly, so neither side can resolve to a same-named object elsewhere
    // on the search path.
    const rows = (await tx.unsafe(
      `SELECT pg_get_viewdef(to_regclass('"public"."${view.name}"')) AS installed,
              pg_get_viewdef(to_regclass('pg_temp.${PROBE_VIEW}')) AS generated`
    )) as readonly { readonly installed: string | null; readonly generated: string | null }[]
    const [row] = rows
    return (
      row !== undefined &&
      row.installed !== null &&
      row.generated !== null &&
      row.installed === row.generated
    )
  } finally {
    await tx.unsafe(`DROP VIEW IF EXISTS pg_temp.${PROBE_VIEW}`)
  }
}

/**
 * The first PostgreSQL `INSTEAD OF` function whose installed body is not the
 * generated one, or trigger missing from its view. One catalog read each: a
 * trigger function can change in a binary without its view changing (a fix to
 * how an insert through the view is redirected), so the view comparison alone
 * would leave it stale.
 */
const stalePostgresTriggerObject = async (
  tx: TransactionLike,
  expected: readonly GeneratedViewObject[]
): Promise<string | undefined> => {
  const functions = (await tx.unsafe(
    `SELECT p.proname AS name, p.prosrc AS body FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE '%\\_instead\\_of\\_%'`
  )) as readonly { readonly name: string; readonly body: string }[]
  const triggers = (await tx.unsafe(
    `SELECT c.relname AS on_view, t.tgname AS name FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal`
  )) as readonly { readonly on_view: string; readonly name: string }[]
  const bodies = new Map(functions.map((row) => [row.name, row.body]))
  const attached = new Set(triggers.map((row) => `${row.on_view}:${row.name}`))
  return expected.find((object) =>
    object.kind === 'function'
      ? bodies.get(object.name) !== object.sql
      : object.kind === 'trigger' && !attached.has(`${object.on ?? ''}:${object.name}`)
  )?.name
}

/**
 * The first PostgreSQL view whose installed definition is not the generated
 * one — or `INSTEAD OF` function or trigger that is not the generated one. The
 * probes run one after another on `tx`, which must be a single connection (a
 * transaction): a temporary view lives in its session.
 */
const stalePostgresView = async (
  tx: TransactionLike,
  expected: readonly GeneratedViewObject[]
): Promise<string | undefined> => {
  const staleView = await expected
    .filter((object) => object.kind === 'view')
    .reduce<Promise<string | undefined>>(async (previous, view) => {
      const found = await previous
      if (found !== undefined) return found
      return (await postgresViewMatches(tx, view)) ? undefined : view.name
    }, Promise.resolve(undefined))
  return staleView ?? stalePostgresTriggerObject(tx, expected)
}

/**
 * The name of the first installed view (or SQLite trigger) whose definition is
 * not the one this binary generates for `tables`, or `undefined` when every
 * one matches. On PostgreSQL `tx` must be a single connection.
 */
export const findStaleViewDefinition = (
  tx: TransactionLike,
  tables: readonly Table[],
  dialect: 'postgres' | 'sqlite'
): Promise<string | undefined> => {
  const expected = generatedViewObjects(tables, dialect)
  if (expected.length === 0) return Promise.resolve(undefined)
  return dialect === 'sqlite' ? staleSqliteObject(tx, expected) : stalePostgresView(tx, expected)
}
