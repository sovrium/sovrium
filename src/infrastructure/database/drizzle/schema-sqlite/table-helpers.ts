/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SQLite table-prefix helpers.
 *
 * SQLite has no concept of schemas. The PostgreSQL schema namespacing used by
 * the pg-core schema tree — `pgSchema('auth')` and `pgSchema('system')` — is
 * mirrored here as a flat table-name prefix instead:
 *
 *   pgSchema('auth').table('user', …)     → authTable('user', …)   → `auth_user`
 *   pgSchema('system').table('x', …)      → systemTable('x', …)    → `system_x`
 *
 * Plain `pgTable(name, …)` tables in the `public` schema map to plain
 * `sqliteTable(name, …)` with no prefix.
 *
 * Both helpers are produced by `sqliteTableCreator`, so they carry the exact
 * overloaded `SQLiteTableFn` signature of `sqliteTable` — `$inferSelect` /
 * `$inferInsert` type inference and the `(table) => [...]` extra-config form
 * all work identically to the pg-core mirror files.
 */

import { sqliteTableCreator } from 'drizzle-orm/sqlite-core'

/**
 * Define a table in the logical `auth` namespace.
 * The physical SQLite table name is prefixed with `auth_`.
 */
export const authTable = sqliteTableCreator((name) => `auth_${name}`)

/**
 * Define a table in the logical `system` namespace.
 * The physical SQLite table name is prefixed with `system_`.
 */
export const systemTable = sqliteTableCreator((name) => `system_${name}`)
