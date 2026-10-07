/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { SQL } from 'drizzle-orm'

/**
 * Qualified reference to the engine-managed `user_access` table, as a `SQL`
 * fragment.
 *
 * Postgres keeps it in the dedicated `system` schema; SQLite has no schemas, so
 * the namespace is a flat name prefix (`system_user_access`) — see
 * `schema/user-access-table.ts`, which emits exactly these two names.
 *
 * Both arms render character-for-character what the previous string form did
 * (`"system"."user_access"` / `"system_user_access"`), which is what keeps
 * `isMissingUserAccessTable` working: that guard matches on the driver's error
 * text, and the driver quotes the name back exactly as the statement spelled it.
 */
export const userAccessTableSql = (): Readonly<SQL> =>
  isSqliteRuntime()
    ? sql`${sql.identifier('system_user_access')}`
    : sql`${sql.identifier('system')}.${sql.identifier('user_access')}`

/** Every message in an error's transitive `cause` chain, outermost first. */
const causeChainMessages = (error: unknown, depth = 0): readonly string[] => {
  if (depth >= 6 || error === null || typeof error !== 'object') return []
  const node = error as { readonly message?: unknown; readonly cause?: unknown }
  const own = typeof node.message === 'string' ? [node.message] : []
  return [...own, ...causeChainMessages(node.cause, depth + 1)]
}

/**
 * Whether `error` means the `user_access` table has not been created — the
 * normal state for an app that declares no `auth.scopeTables`.
 *
 * Two things this has to survive:
 *
 *   - Dialect phrasing. Postgres says `relation "system.user_access" does not
 *     exist`; SQLite says `no such table: system_user_access`. Matching only the
 *     Postgres wording let every SQLite miss escape as a genuine failure.
 *   - Driver wrapping. These reads now go through Drizzle rather than a raw
 *     `sql.unsafe()`, and Drizzle rethrows as `DrizzleQueryError` with the real
 *     driver error on `cause` — so the whole chain is walked instead of only the
 *     outermost message. (Measured: `bun:sqlite` surfaces
 *     `SQLiteError` unwrapped, but relying on that would make the guard depend
 *     on an implementation detail of one driver.)
 */
export const isMissingUserAccessTable = (error: unknown): boolean =>
  causeChainMessages(error).some(
    (message) =>
      /relation .*user_access.* does not exist/i.test(message) ||
      /no such table:.*user_access/i.test(message)
  )

/**
 * Normalize a stored `record_ids` cell into a list of record ids.
 *
 * Postgres stores it as a native `TEXT[]` and the driver hands back a JS array.
 * SQLite has no array type, so the column is TEXT holding a JSON array (see the
 * SQLite DDL in `schema/user-access-table.ts`) and must be parsed.
 */
export const toRecordIdList = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value as readonly string[]
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as readonly string[]) : []
  } catch {
    return []
  }
}
