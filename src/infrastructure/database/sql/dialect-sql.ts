/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { nowSqlLiteral } from './dialect-ddl'

/**
 * Dialect-aware runtime SQL fragments for the dynamic records/forms CRUD layer.
 *
 * These are the small per-dialect SQL idioms that recur inside hand-written
 * `sql` template queries — the "current timestamp" function and the auth-table
 * reference — centralized so CRUD callsites stay dialect-agnostic.
 */

/**
 * "Current timestamp" SQL expression for the active dialect.
 *
 * - PostgreSQL: `NOW()` — a `timestamptz`.
 * - SQLite: a strict ISO-8601 `TEXT` value via `strftime` (the `SQLITE_ISO_NOW`
 *   constant in `dialect-ddl.ts`), matching the `TEXT` storage SQLite uses for
 *   timestamp columns.
 *
 * This is the Drizzle-fragment form of {@link nowSqlLiteral}, and delegates to
 * it so the two cannot drift.
 *
 * SQLite's bare `CURRENT_TIMESTAMP` is deliberately NOT used, despite being the
 * obvious choice: it yields `'YYYY-MM-DD HH:MM:SS'` — no `T` separator, no `Z`,
 * no milliseconds — which is not valid ISO-8601. The dynamic-table
 * `created_at`/`updated_at` columns are written with `SQLITE_ISO_NOW`, so a bare
 * `CURRENT_TIMESTAMP` here would store `deleted_at` in a different format from
 * its own siblings in the same `TEXT` column family. That breaks two things the
 * moment either is exercised: the records-API response validator
 * (`z.iso.datetime()`) rejects the bare form, and it sorts BEFORE its own
 * `created_at` because `' '` < `'T'` lexicographically.
 *
 * Use this in place of a literal `NOW()` inside Drizzle `sql` fragments — e.g.
 * `sql\`SET deleted_at = ${nowExpr()}\``.
 */
export const nowExpr = () => sql.raw(nowSqlLiteral())

/**
 * A Better Auth table reference for the active dialect.
 *
 * - PostgreSQL: `auth.<name>` — the table lives in the dedicated `auth` schema.
 * - SQLite: `auth_<name>` — SQLite has no schemas, so the schema namespace is a
 *   flat table-name prefix (`authTable` / `sqliteTableCreator`), matching the
 *   `schema-sqlite/` mirror.
 *
 * Use this inside `sql` fragments that hand-write a query against an auth
 * table (joins, GDPR erasure deletes, …).
 *
 * @param name - the bare Better Auth table name (`user`, `session`, `account`, …)
 */
export const authTableRef = (name: string) =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw(`auth_${name}`)
    : sql.raw(`auth.${name}`)

/**
 * The SQLite physical table name for a `system`-namespaced table.
 *
 * SQLite has no schemas, so the `system` namespace is a flat table-name prefix
 * (`systemTable` / `sqliteTableCreator`), matching the `schema-sqlite/` mirror.
 *
 * Exported so catalog probes (`sqlite_master`) derive the physical name from the
 * SAME rule {@link systemTableRef} uses to write the query — a probe that
 * re-spelled the prefix would silently report "table absent" the day the rule
 * changed, and a caller guarding a DELETE on that answer would skip the delete
 * instead of failing loudly.
 *
 * @param name - the bare system table name (`user_access`, …)
 */
export const sqliteSystemTableName = (name: string) => `system_${name}`

/**
 * A `system`-namespaced table reference for the active dialect.
 *
 * - PostgreSQL: `system."<name>"` — the table lives in the dedicated `system`
 *   schema.
 * - SQLite: `system_<name>` — see {@link sqliteSystemTableName}.
 *
 * Use this inside `sql` fragments that hand-write a query against an internal
 * platform table (the GDPR erasure sweep over the form-submission ledger, …).
 * Same rationale as {@link authTableRef}.
 *
 * @param name - the bare system table name (`form_submissions`, …)
 */
export const systemTableRef = (name: string) =>
  parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sql.raw(sqliteSystemTableName(name))
    : sql.raw(`system."${name}"`)

/**
 * The Better Auth `user` table reference for the active dialect.
 *
 * Convenience wrapper over {@link authTableRef} for the most-referenced table
 * (e.g. authorship-column joins in the trash listing).
 */
export const authUserTableRef = () => authTableRef('user')
