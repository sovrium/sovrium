/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/**
 * Dialect-aware runtime SQL fragments for the dynamic records/forms CRUD layer.
 *
 * These are the small per-dialect SQL idioms that recur inside hand-written
 * `sql` template queries — the auth-table and system-table references —
 * centralized so CRUD callsites stay dialect-agnostic.
 */

/**
 * A Better Auth table reference on `dialect`.
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
export const authTableRefOn = (dialect: DatabaseDialect, name: string) =>
  dialect === 'sqlite' ? sql.raw(`auth_${name}`) : sql.raw(`auth.${name}`)

/**
 * The SQLite physical table name for a `system`-namespaced table.
 *
 * SQLite has no schemas, so the `system` namespace is a flat table-name prefix
 * (`systemTable` / `sqliteTableCreator`), matching the `schema-sqlite/` mirror.
 *
 * Exported so catalog probes (`sqlite_master`) derive the physical name from the
 * SAME rule {@link systemTableRefOn} uses to write the query — a probe that
 * re-spelled the prefix would silently report "table absent" the day the rule
 * changed, and a caller guarding a DELETE on that answer would skip the delete
 * instead of failing loudly.
 *
 * @param name - the bare system table name (`user_access`, …)
 */
export const sqliteSystemTableName = (name: string) => `system_${name}`

/**
 * A `system`-namespaced table reference on `dialect`.
 *
 * - PostgreSQL: `system."<name>"` — the table lives in the dedicated `system`
 *   schema.
 * - SQLite: `system_<name>` — see {@link sqliteSystemTableName}.
 *
 * Use this inside `sql` fragments that hand-write a query against an internal
 * platform table (the GDPR erasure sweep over the form-submission ledger, …).
 * Same rationale as {@link authTableRefOn}.
 *
 * @param name - the bare system table name (`form_submissions`, …)
 */
export const systemTableRefOn = (dialect: DatabaseDialect, name: string) =>
  dialect === 'sqlite' ? sql.raw(sqliteSystemTableName(name)) : sql.raw(`system."${name}"`)
