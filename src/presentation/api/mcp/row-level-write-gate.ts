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
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import {
  createAllowed,
  existingRowIsGoverned,
  existingRowWriteAllowed,
} from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App, Table } from '@/domain/models/app'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

/**
 * Whether the proposed row satisfies the table's `create.when` rule. A row the
 * caller would file outside its own scope (another user's `owner_id`, say) is
 * refused before anything is written, and so is any row a rule governs when
 * the caller has no identity.
 */
export const createIsInScope = (
  table: Table,
  fields: Readonly<Record<string, unknown>>,
  ctx: CurrentUserContext | undefined
): boolean => createAllowed(table, fields, ctx)

export interface ExistingRowScopeInput {
  readonly app: App
  readonly table: Table
  readonly session: UserSession
  readonly recordId: string
  readonly ctx: CurrentUserContext | undefined
  /** `write` for an update, `delete` for a delete. */
  readonly op: 'write' | 'delete'
  /** The change an update proposes — checked against the row as written too. */
  readonly change?: Readonly<Record<string, unknown>>
}

/**
 * Whether an existing row may be written or deleted by the caller: it must be
 * readable under `read.when` AND satisfy the operation's own rule — for an
 * update, on the row as it stands and as it would be written. A row that does
 * not exist, or cannot be fetched, is out of scope — the same `Resource not
 * found` the records API answers.
 */
export const existingRowIsInScope = async (input: ExistingRowScopeInput): Promise<boolean> => {
  const { app, table, session, recordId, ctx, op, change } = input
  if (!existingRowIsGoverned(table.rowLevelPermissions, op)) return true
  if (ctx === undefined) return false
  if (ctx.isUnrestricted) return true

  const fetched = await Effect.runPromise(
    Effect.result(provideTableLive(rawGetRecordProgram(session, table.name, recordId, app)))
  )
  if (fetched._tag === 'Failure' || !fetched.success) return false
  return existingRowWriteAllowed({
    rlp: table.rowLevelPermissions,
    op,
    // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
    existing: readStoredValues(table, fetched.success),
    change,
    ctx,
  })
}
