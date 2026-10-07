/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin read tools' NAMES: MCP tools that answer what the admin API answers.
 *
 * Each tool mirrors one `GET /api/admin/*` read — the same use-case, the same
 * wire schema, the same admin audit event — for an admin-tier credential. The
 * operations themselves are the application registry
 * (`src/application/use-cases/admin/admin-read-registry.ts`); this module holds
 * only the pure naming rules every reader of those names shares: how a tool is
 * named from the app's name, and which user tool would collide with one.
 *
 * The family is compiled from the app's NAME alone, so no configuration can
 * add, remove or rename a tool in it.
 *
 * Names are reserved EXACTLY, never by an `_admin_` infix: a table of the
 * operator's called `admin_notes` compiles to `{app}_admin_notes_list`, which
 * carries the infix while being an ordinary data tool every allowed role sees.
 */

import { toolSafeTableName } from '@/domain/models/app/auth/ai-access'

/** `{app}_admin_{suffix}`. */
export const adminReadToolName = (appName: string, suffix: string): string =>
  `${appName}_admin_${suffix}`

/** A user tool that would answer to an admin read tool's name. */
export interface AdminReadToolCollision {
  readonly toolName: string
  /** The table whose tool it is, when one can be named. */
  readonly tableName: string | undefined
}

/**
 * The first user-compiled tool whose name is one of `reservedNames`.
 *
 * Compares the two name SETS rather than a list of reserved table names, so a
 * follow-on admin read tool is covered without a second list to maintain. The
 * owning table is the one whose tool prefix `{app}_{table}_` is the longest
 * prefix of the colliding name — a table called `admin_automation` and one
 * called `admin_automation_runs` both prefix `crm_admin_automation_runs_list`,
 * and only the longer one compiles to it.
 */
export const findAdminReadToolCollision = (
  appName: string,
  reservedNames: ReadonlySet<string>,
  userToolNames: ReadonlyArray<string>,
  tableNames: ReadonlyArray<string>
): AdminReadToolCollision | undefined => {
  const toolName = userToolNames.find((name) => reservedNames.has(name))
  if (toolName === undefined) return undefined
  const owners = tableNames
    .filter((table) => toolName.startsWith(`${appName}_${toolSafeTableName(table)}_`))
    .toSorted((left, right) => toolSafeTableName(right).length - toolSafeTableName(left).length)
  return { toolName, tableName: owners[0] }
}
