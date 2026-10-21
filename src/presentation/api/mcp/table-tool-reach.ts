/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which table a `{app}_{table}_{operation}` tool names, and whether its caller
 * reads that table at all.
 *
 * A table's READ tools (`_list`, `_read`) exist for a caller only where the
 * records list would answer her: the table's read gate admits her, and her
 * list of it admits her at least one row ({@link readerRowsOf}). Elsewhere the
 * records API answers her as a table that does not exist, so `tools/list`
 * offers her neither tool, and a call naming one is answered exactly as a call
 * naming a tool the server does not have. The write tools follow the role's
 * write permissions as before: a table she may write without reading keeps its
 * create and update tools.
 */

import { synthesizeCallerSession } from '@/application/use-cases/tables/list-records-as-caller'
import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import { getUserAccessRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { isAiAccessEnabled, toolSafeTableName } from '@/domain/models/app/auth/ai-access'
import { runOnDomain, type DomainContext } from '@/infrastructure/logging/request-effect'
import {
  passesTablePermission,
  resolveCallerAuthority,
  type CallerAuthority,
} from './caller-authority'
import type { McpCaller } from './auth'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App, Table } from '@/domain/models/app'
import type { AiAccess, AiAccessOperation } from '@/domain/models/app/auth/ai-access'

const SUPPORTED_OPERATIONS: ReadonlySet<AiAccessOperation> = new Set([
  'read',
  'list',
  'create',
  'update',
  'delete',
])

/** The table and operation a table tool names. */
export interface ResolvedTool {
  readonly table: Table
  readonly operation: AiAccessOperation
}

/**
 * Map a tool name like `crm_contacts_list` back to the source table +
 * operation. The split is deterministic because the operation is always the
 * trailing token (one of read/list/create/update/delete) and the appName
 * prefix matches `app.name`.
 */
export const resolveTableTool = (app: App, toolName: string): ResolvedTool | undefined => {
  const prefix = `${app.name}_`
  if (!toolName.startsWith(prefix)) return undefined
  const remainder = toolName.slice(prefix.length)
  const lastUnderscore = remainder.lastIndexOf('_')
  if (lastUnderscore <= 0) return undefined

  const operation = remainder.slice(lastUnderscore + 1) as AiAccessOperation
  if (!SUPPORTED_OPERATIONS.has(operation)) return undefined

  const toolTable = remainder.slice(0, lastUnderscore)
  const table = (app.tables ?? []).find((t) => toolSafeTableName(t.name) === toolTable)
  if (table === undefined) return undefined
  if (!isAiAccessEnabled(table.aiAccess)) return undefined
  if (!isOperationAllowedByAiAccess(table.aiAccess, operation)) return undefined
  return { table, operation }
}

const isOperationAllowedByAiAccess = (
  access: AiAccess | undefined,
  operation: AiAccessOperation
): boolean => {
  if (access === undefined || typeof access === 'boolean') return true
  if (access.operations === undefined) return true
  return access.operations.includes(operation)
}

/** True for the operations that read a table: `list` and `read`. */
export const isReadOperation = (operation: AiAccessOperation): boolean =>
  operation === 'list' || operation === 'read'

/** How the sessions an MCP call synthesises are named. */
const MCP_SESSION_LABEL = { id: 'mcp-session', token: 'mcp-bearer' } as const

/**
 * The synthetic session an MCP call runs the application programs with. Every
 * authenticated caller names a user; `userId` is `undefined` only on the
 * unreachable fail-closed fallback caller.
 */
export const synthesizeSession = (userId: string | undefined): UserSession =>
  synthesizeCallerSession(userId, MCP_SESSION_LABEL)

/** The two lookups a caller's permission identity is read with. */
export interface AuthorityLookups {
  readonly lookupGroups: (userId: string) => Promise<readonly string[]>
  readonly lookupAccessRoles: (userId: string) => Promise<readonly string[]>
}

/** The lookups on the domain runtime's own services: nothing is built per call. */
const domainLookups = (domainContext: DomainContext): AuthorityLookups => ({
  lookupGroups: (userId) => runOnDomain(domainContext, getUserGroups(userId)),
  lookupAccessRoles: (userId) => runOnDomain(domainContext, getUserAccessRoles(userId)),
})

/**
 * The caller's authority on `table`, from an authority resolved WITH her
 * assignment roles: they count only on a table with row-level rules, as on
 * the records route, so elsewhere they are dropped.
 */
export const authorityOnTable = (authority: CallerAuthority, table: Table): CallerAuthority =>
  table.rowLevelPermissions === undefined && authority.accessRoles.length > 0
    ? { ...authority, accessRoles: [] }
    : authority

/**
 * One permission identity for every table in `tables` — the account role,
 * its groups and its assignment roles, each looked up at most ONCE however
 * many tables are asked about. Assignment roles are read only when one of the
 * tables has row-level rules; {@link authorityOnTable} narrows the result to
 * one table.
 */
export const resolveAuthorityForTables = (
  app: App,
  caller: McpCaller,
  tables: readonly Table[],
  lookups: AuthorityLookups
): Promise<CallerAuthority> =>
  resolveCallerAuthority({
    app,
    caller,
    lookupGroups: lookups.lookupGroups,
    lookupAccessRoles: (userId) =>
      tables.some((table) => table.rowLevelPermissions !== undefined)
        ? lookups.lookupAccessRoles(userId)
        : Promise.resolve([]),
  })

/**
 * One permission identity for a call on `table` — the account role plus its
 * groups — so the table gate, the field-write check, the row-level context
 * and the programs' field-read filtering all see the role the records API
 * sees, never the three-tier MCP view `caller.role` holds.
 */
export const resolveTableAuthority = (
  app: App,
  caller: McpCaller,
  table: Table,
  domainContext: DomainContext
): Promise<CallerAuthority> =>
  resolveAuthorityForTables(app, caller, [table], domainLookups(domainContext))

/**
 * The caller's authority for a `tools/list` over `tables`, resolved once —
 * {@link authorityOnTable} gives each table its own.
 */
export const resolveListingAuthority = (
  app: App,
  caller: McpCaller,
  tables: readonly Table[],
  domainContext: DomainContext
): Promise<CallerAuthority> =>
  resolveAuthorityForTables(app, caller, tables, domainLookups(domainContext))

declare const listedTableBrand: unique symbol

/**
 * Proof that the records list answers a caller on `table`: its read gate admits
 * her, and her list of it admits her at least one row. Only
 * {@link listedTableFor} mints one, so a read tool that requires it cannot be
 * reached without asking.
 */
export interface ListedTable {
  readonly table: Table
  readonly [listedTableBrand]: true
}

/**
 * The {@link ListedTable} proof for `caller` on `table`, or `undefined` where
 * the records list would answer her as a table that does not exist.
 */
export const listedTableFor = async (
  app: App,
  table: Table,
  caller: McpCaller,
  options: { readonly domainContext: DomainContext; readonly authority?: CallerAuthority }
): Promise<ListedTable | undefined> => {
  const authority =
    options.authority ?? (await resolveTableAuthority(app, caller, table, options.domainContext))
  if (!passesTablePermission(app, table, 'read', authority)) return undefined
  const reader = {
    session: synthesizeSession(caller.userId),
    role: authority.role,
    groups: authority.groups,
  }
  const rows = await runOnDomain(options.domainContext, readerRowsOf(app, table.name, reader))
  return rows.admission.kind === 'no-row' ? undefined : ({ table } as ListedTable)
}

/**
 * Whether the records list would answer `caller` on `table`: its read gate
 * admits her, and her list of it admits her at least one row.
 */
export const callerListsTable = async (
  app: App,
  table: Table,
  caller: McpCaller,
  options: { readonly domainContext: DomainContext; readonly authority?: CallerAuthority }
): Promise<boolean> => (await listedTableFor(app, table, caller, options)) !== undefined
