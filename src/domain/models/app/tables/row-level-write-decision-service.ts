/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The row-level WRITE decision, as one pure function per operation.
 *
 * Every door that writes a record answers to the same rules — the records API,
 * the MCP table tools, and an automation run someone started by hand — so the
 * decision lives here, once, and each door only fetches the row it needs:
 *
 *   - `create.when` is checked against the row as it will be stored: the
 *     proposed fields, with the field defaults the insert applies filled in
 *     where the caller left a field out;
 *   - an update or delete must find the row readable under `read.when` and
 *     inside its own rule (`write.when` / `delete.when`) as it stands;
 *   - an update is ALSO checked against the row as it would be written — the
 *     stored row with the change laid over it — so a caller cannot move a
 *     record out of its own reach (reassign a ticket to a client it does not
 *     serve) by editing the very column the rule reads.
 *
 * An unrestricted context (an admin-equivalent role) skips row scoping. A
 * caller with no identity (`ctx === undefined`) cannot satisfy a rule that
 * exists, so every write a rule governs is refused.
 */

import { buildCreateAuthorshipOverrides, buildCurrentUserDefaults } from './authorship-fields'
import { isEmptyDateValue } from './empty-date-service'
import {
  evaluateRecordAgainstPredicate,
  type CurrentUserContext,
} from './row-level-evaluator-service'
import type { RowLevelPermissions } from './permissions'

/** The four operations a row-level rule can govern. */
export type RowLevelOperation = 'read' | 'write' | 'create' | 'delete'

type RowPredicate = NonNullable<NonNullable<RowLevelPermissions['read']>['when']>

type Row = Readonly<Record<string, unknown>>

/** The rule a table declares for one operation, if any. */
export const rowLevelRuleFor = (
  rlp: RowLevelPermissions | undefined,
  op: RowLevelOperation
): RowPredicate | undefined => {
  if (rlp === undefined) return undefined
  if (op === 'read') return rlp.read?.when
  if (op === 'write') return rlp.write?.when
  if (op === 'create') return rlp.create?.when
  return rlp.delete?.when
}

/**
 * Whether one row passes the table's rule for one operation. No rule, or an
 * unrestricted caller, passes; a caller with no identity fails a rule that
 * exists.
 */
export const rowPassesRule = (
  rlp: RowLevelPermissions | undefined,
  op: RowLevelOperation,
  row: Row,
  ctx: CurrentUserContext | undefined
): boolean => {
  const rule = rowLevelRuleFor(rlp, op)
  if (rule === undefined) return true
  if (ctx === undefined) return false
  if (ctx.isUnrestricted) return true
  return evaluateRecordAgainstPredicate(row, rule, ctx)
}

/** Whether the table declares any rule an existing-row operation answers to. */
export const existingRowIsGoverned = (
  rlp: RowLevelPermissions | undefined,
  op: 'write' | 'delete'
): boolean => rowLevelRuleFor(rlp, 'read') !== undefined || rowLevelRuleFor(rlp, op) !== undefined

/** The row as an update would leave it: the stored row with the change laid over it. */
export const rowAsWritten = (existing: Row, change: Row): Row => ({ ...existing, ...change })

export interface ExistingRowWriteInput {
  readonly rlp: RowLevelPermissions | undefined
  /** `write` for an update, `delete` for a delete. */
  readonly op: 'write' | 'delete'
  /** The row as it stands. */
  readonly existing: Row
  /** The change an update proposes; ignored for a delete. */
  readonly change?: Row
  readonly ctx: CurrentUserContext | undefined
}

/**
 * Whether an existing row may be updated or deleted: readable under
 * `read.when`, inside the operation's own rule as it stands, and — for an
 * update carrying a change — still inside `write.when` as it would be written.
 */
export const existingRowWriteAllowed = (input: ExistingRowWriteInput): boolean => {
  const { rlp, op, existing, change, ctx } = input
  if (!rowPassesRule(rlp, 'read', existing, ctx)) return false
  if (!rowPassesRule(rlp, op, existing, ctx)) return false
  if (op !== 'write' || change === undefined) return true
  return rowPassesRule(rlp, 'write', rowAsWritten(existing, change), ctx)
}

/** The part of a field the create decision reads: its name, type and default. */
interface CreatedFieldShape {
  readonly name: string
  readonly type: string
  readonly default?: unknown
  readonly required?: unknown
}

/** The part of a table the create decision reads. */
export interface CreatedRowTable {
  readonly name: string
  readonly fields: ReadonlyArray<CreatedFieldShape>
  readonly rowLevelPermissions?: RowLevelPermissions
}

/** Defaults the database computes at insert time (a clock), unknown beforehand. */
const COMPUTED_DEFAULTS: ReadonlySet<string> = new Set(['CURRENT_DATE', 'NOW()', 'NOW'])

/**
 * The value a field's column DEFAULT stores when an insert leaves the field
 * out, or `undefined` when it stores nothing the rule could read: no default,
 * a clock the database reads at insert time, or `''` on a date (no date).
 */
const literalDefaultOf = (field: CreatedFieldShape): unknown => {
  if (field.type === 'progress' && field.required === true && field.default === undefined) return 0
  const value = field.default
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return typeof value === 'string' && storesText(field.type, value) ? value : undefined
}

/** Whether a text default is stored as that text (not a clock, the caller, or no date). */
const storesText = (type: string, value: string): boolean =>
  !COMPUTED_DEFAULTS.has(value.toUpperCase()) &&
  value !== '$currentUser' &&
  !isEmptyDateValue(type, value)

/**
 * The row a create will store, as a row rule reads it: the proposed fields,
 * each field the caller left out filled with its column default, a `user`
 * field defaulting to `$currentUser` filled with the caller, and the
 * authorship stamps (`created-by` / `updated-by`) set to the caller.
 */
export const rowAsCreated = (table: CreatedRowTable, proposed: Row, actorId: string): Row => {
  const defaults = Object.fromEntries(
    table.fields
      .filter((field) => proposed[field.name] === undefined)
      .map((field) => [field.name, literalDefaultOf(field)] as const)
      .filter(([, value]) => value !== undefined)
  )
  const tables = [table]
  return {
    ...defaults,
    ...proposed,
    ...buildCurrentUserDefaults(tables, table.name, actorId, proposed),
    ...buildCreateAuthorshipOverrides(tables, table.name, actorId),
  }
}

/**
 * Whether a proposed row may be created under the table's `create.when` rule,
 * judged on the row as it will be stored ({@link rowAsCreated}). A ruled field
 * the caller leaves out with no default is stored empty, and an empty value
 * satisfies no rule, `neq` included.
 */
export const createAllowed = (
  table: CreatedRowTable,
  proposed: Row,
  ctx: CurrentUserContext | undefined
): boolean =>
  rowPassesRule(
    table.rowLevelPermissions,
    'create',
    ctx === undefined ? proposed : rowAsCreated(table, proposed, ctx.userId),
    ctx
  )
