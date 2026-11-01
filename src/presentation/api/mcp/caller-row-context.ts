/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { authorizeRead } from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import {
  loadCurrentUserContext,
  rowRuleScopeOf,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { recordPassesReadPredicate } from '@/application/use-cases/tables/permissions/row-level-read-filter'
import { tableEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { runOnDomain, type DomainContext } from '@/infrastructure/logging/request-effect'
import type { CallerAuthority } from './caller-authority'
import type { AuthorizationCaller } from '@/application/use-cases/tables/permissions/authorization-caller'
import type { App, Table } from '@/domain/models/app'
import type {
  CurrentUserContext,
  RowLevelFilterNode,
} from '@/domain/models/app/tables/row-level-evaluator-service'

/**
 * The caller a verdict judges: her row-level context, and the effective roles
 * the MCP table gate already admitted her on (`passesTablePermission`), so the
 * verdict's grant checks agree with the gate the tool call passed. Every
 * credential `/mcp` accepts names a signed-in user.
 */
export const authorizationCallerOf = (
  app: App,
  table: Table,
  authority: CallerAuthority,
  ctx: CurrentUserContext
): AuthorizationCaller => ({
  current: ctx,
  effectiveRoles: tableEffectiveRoles(table, authority),
  allTables: app,
  signedOut: false,
})

/**
 * Whether the read tool may hand back the fetched record: the read verdict for
 * that row, judged as the records API reads it (SQLite `1`/`0` as booleans).
 * A caller with no identity reads no row a rule governs.
 */
export const recordIsReadable = (input: {
  readonly app: App
  readonly table: Table
  readonly authority: CallerAuthority
  readonly record: Readonly<Record<string, unknown>>
  readonly ctx: CurrentUserContext | undefined
}): boolean => {
  const { app, table, authority, record, ctx } = input
  if (ctx === undefined) return recordPassesReadPredicate(table, record, ctx)
  const caller = authorizationCallerOf(app, table, authority, ctx)
  const verdict = authorizeRead(table, caller, readStoredValues(table, record))
  return Effect.runSync(verdict)._tag === 'Allowed'
}

/** The list tool's row clause: none, every row refused, or the clause to AND onto the query. */
export type ListRowFilter = 'none' | 'refused' | { readonly and: readonly RowLevelFilterNode[] }

/**
 * The list tool's row clause, from the read verdict's projected rule. The
 * table's read grant is already proven (the list tool runs only for a table
 * whose records list answers the caller), so a refused verdict refuses every
 * row as a rule admitting none does. An unrestricted caller, or a table with
 * no read rule, lists every row; a rule that cannot be projected, or that
 * matches nothing, lists none. A caller with no identity reads no row a rule
 * governs.
 */
export const listRowFilterOf = (input: {
  readonly app: App
  readonly table: Table
  readonly authority: CallerAuthority
  readonly ctx: CurrentUserContext | undefined
}): ListRowFilter => {
  const { app, table, authority, ctx } = input
  if (ctx === undefined) return table.rowLevelPermissions?.read?.when ? 'refused' : 'none'
  const verdict = Effect.runSync(
    authorizeRead(table, authorizationCallerOf(app, table, authority, ctx))
  )
  if (verdict._tag !== 'Allowed') return 'refused'
  const { rowRule } = verdict
  if (rowRule === 'no-rlp' || rowRule === 'bypass') return 'none'
  if (rowRule === 'empty' || rowRule === undefined) return 'refused'
  return { and: [rowRule] }
}

/**
 * Resolve a `CurrentUserContext` from the authenticated caller, or `undefined`
 * with no userId (only the unreachable fail-closed fallback caller): the
 * row-level gates read an absent context as "no identity" and DENY every row.
 */
export async function resolveUserContextOrUndefined(input: {
  readonly caller: { readonly userId: string | undefined }
  readonly authority: CallerAuthority
  readonly table: Table
  readonly app: App
  /** The server runtime's services, built once at boot: nothing is rebuilt per call. */
  readonly domainContext: DomainContext
}): Promise<CurrentUserContext | undefined> {
  const { caller, authority, table, app, domainContext } = input
  const { userId } = caller
  if (!userId) return undefined
  const projection = toSessionProjection(
    { userId },
    { role: authority.role, isUnrestricted: isAdminEquivalent(authority.role, app) }
  )
  const scope = rowRuleScopeOf(table, app.tables)
  return runOnDomain(
    domainContext,
    loadCurrentUserContext(projection, table.rowLevelPermissions, scope)
  )
}
