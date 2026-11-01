/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Row-level WRITE gates for the MCP table tools.
 *
 * The records API refuses an out-of-scope write before the write happens:
 * `create.when` is evaluated against the proposed row, `write.when` and
 * `delete.when` against the row as it stands, and a row the caller cannot
 * READ is refused before any other rule is consulted, so its existence is not
 * disclosed (`record-write-gates.ts`, `record-delete-gate.ts`). A write tool
 * is the same write over another transport, and a client can name any row id
 * by hand — so the same predicates run here, and every refusal is the records
 * API's own `Resource not found`.
 *
 * A refusal carries nothing of the row: the gate answers a boolean, and the
 * caller throws a bare JSON-RPC error. An update that echoed the stored row on
 * refusal would turn the write tool into a read of a hidden record.
 *
 * An unrestricted context is an admin-equivalent role and skips row scoping.
 * `ctx === undefined` is a caller with no identity — only the fail-closed
 * fallback caller, since every credential `/mcp` accepts names a user — and a
 * rule cannot be evaluated for nobody, so every write a rule governs is
 * refused, as the read and list tools refuse the rows.
 */

import { Effect } from 'effect'
import {
  authorizeCreate,
  authorizeDelete,
  authorizeUpdate,
} from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import { rowsReaderMayNotList } from '@/application/use-cases/tables/row-read-admission'
import {
  createAllowed,
  existingRowIsGoverned,
} from '@/domain/models/app/tables/row-level-write-decision-service'
import { runOnDomain, type DomainContext } from '@/infrastructure/logging/request-effect'
import { authorizationCallerOf } from './caller-row-context'
import type { CallerAuthority } from './caller-authority'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App, Table } from '@/domain/models/app'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

/**
 * Whether the proposed row satisfies the table's `create.when` rule: the
 * create verdict for that row. A row the caller would file outside its own
 * scope (another user's `owner_id`, say) is refused before anything is
 * written, and so is any row a rule governs when the caller has no identity.
 */
export const createIsInScope = (input: {
  readonly app: App
  readonly table: Table
  readonly authority: CallerAuthority
  readonly fields: Readonly<Record<string, unknown>>
  readonly ctx: CurrentUserContext | undefined
}): boolean => {
  const { app, table, authority, fields, ctx } = input
  // No identity: no caller to judge, so a rule governing the row refuses it.
  if (ctx === undefined) return createAllowed(table, fields, ctx)
  const caller = authorizationCallerOf(app, table, authority, ctx)
  return Effect.runSync(authorizeCreate(table, caller, [fields]))._tag === 'Allowed'
}

export interface ExistingRowScopeInput {
  readonly app: App
  readonly table: Table
  readonly authority: CallerAuthority
  readonly session: UserSession
  readonly recordId: string
  readonly ctx: CurrentUserContext | undefined
  /** `write` for an update, `delete` for a delete. */
  readonly op: 'write' | 'delete'
  /** The change an update proposes — checked against the row as written too. */
  readonly change?: Readonly<Record<string, unknown>>
  /** The server runtime's services, built once at boot. */
  readonly domainContext: DomainContext
}

/**
 * Whether an existing row may be written or deleted by the caller: the update
 * or delete verdict for the record — readable under `read.when` AND inside the
 * operation's own rule, for an update on the row as it stands and as it would
 * be written. A row that does not exist, or cannot be fetched, is out of scope
 * — the same `Resource not found` the records API answers.
 */
export const existingRowIsInScope = async (input: ExistingRowScopeInput): Promise<boolean> => {
  const { app, table, authority, session, recordId, ctx, op, change, domainContext } = input
  if (!existingRowIsGoverned(table.rowLevelPermissions, op)) return true
  if (ctx === undefined) return false
  if (ctx.isUnrestricted) return true

  const caller = authorizationCallerOf(app, table, authority, ctx)
  const target = { kind: 'record', session, tableName: table.name, recordId, change, app } as const
  const verdict =
    op === 'write' ? authorizeUpdate(table, caller, target) : authorizeDelete(table, caller, target)
  return (await runOnDomain(domainContext, verdict))._tag === 'Allowed'
}

/**
 * Whether the caller's list of the table does not admit the record
 * (`rowsReaderMayNotList`). An update or a delete of such a record answers as
 * one of a missing record — and since an id no record holds is never one her
 * list admits, asked first, a missing record and one she may not list answer
 * alike.
 */
export const callerMayNotList = async (input: {
  readonly app: App
  readonly table: Table
  readonly reader: LinkReader
  readonly recordId: string
  readonly domainContext: DomainContext
}): Promise<boolean> => {
  const { app, table, reader, recordId } = input
  const unlisted = await runOnDomain(
    input.domainContext,
    rowsReaderMayNotList(app, table.name, reader, [recordId])
  )
  return unlisted.length > 0
}
