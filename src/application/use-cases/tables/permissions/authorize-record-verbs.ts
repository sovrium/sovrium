/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The authorization verdict for each verb on a table's records: may this
 * caller read, create, update or delete — and if so, inside which row rule?
 *
 * Every door onto the records (the REST routes, a form, a batch) asks one of
 * these and maps the answer to its own transport; none of them re-derives the
 * decision. The verdicts compose the pure domain evaluators — the table-level
 * read verdict (`table-read-grant-service`, which a server-rendered page asks
 * too), the other table-level grants (`permission-evaluator-service`), the
 * in-memory row decision (`row-level-write-decision-service`) and its query projection
 * (`row-level-rule-projection-service`) — and read rows through the
 * repository port only where the decision needs one.
 *
 * The order of every check is part of the contract: a caller who may not read
 * the table learns nothing more (`NotFound`), whatever else she asked.
 */

import { Effect } from 'effect'
import {
  forRoles,
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import {
  judgeTableReadGrant,
  NOT_FOUND_VERDICT,
  type AllowedVerdict,
  type NotFoundVerdict,
} from '@/domain/models/app/auth/table-read-grant-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import {
  projectRowRule,
  rowRuleBatchFilter,
  type RowRuleClause,
} from '@/domain/models/app/tables/row-level-rule-projection-service'
import {
  createAllowed,
  existingRowWriteAllowed,
  rowPassesRule,
  type RowLevelOperation,
} from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { rawListRecordsProgram } from '../raw-list-program'
import { rawGetRecordProgram } from '../read-record-programs'
import type { AuthorizationCaller, FieldCaller } from './authorization-caller'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'

type Row = Readonly<Record<string, unknown>>

/**
 * What a door may do, as a tagged union every door maps to its transport:
 *
 *  - `Allowed` — proceed, inside `rowRule`: the table's rule for the verb,
 *    projected against the caller (a door listing rows ANDs it onto its query) —
 *    and, when the door asked for them ({@link AuthorizationCaller.fields}),
 *    the fields she may read and, for a create or an update, write;
 *  - `NotFound` — the caller may not learn that the record (or the table)
 *    exists: the anti-enumeration answer;
 *  - `Forbidden` — the caller may read the table but not do this: refused by
 *    the table-level `grant`, or by the verb's `row-rule` on the row proposed.
 */
export type Verdict =
  | (AllowedVerdict<RowRuleClause> & AllowedFields)
  | NotFoundVerdict
  | { readonly _tag: 'Forbidden'; readonly refused: 'grant' | 'row-rule' }

/**
 * The table's declared fields an `Allowed` caller may read, and may write — set
 * only when the door asked for them; absent, the door applies its own field
 * rules. Computed by the field-level evaluators every door already asks:
 * `isFieldReadableByCaller` and `forbiddenWriteFields`.
 */
export interface AllowedFields {
  readonly readableFields?: readonly string[]
  readonly writableFields?: readonly string[]
}

const allowed = (rowRule: RowRuleClause, fields: AllowedFields = {}): Verdict => ({
  _tag: 'Allowed',
  rowRule,
  ...fields,
})
const NOT_FOUND: Verdict = NOT_FOUND_VERDICT
const forbidden = (refused: 'grant' | 'row-rule'): Verdict => ({ _tag: 'Forbidden', refused })

/** The field sets of an `Allowed` verdict, for a door that asked for them. */
const fieldSetsOf = (
  table: Table,
  fields: FieldCaller | undefined,
  writes: boolean
): AllowedFields => {
  if (fields === undefined) return {}
  const { app, role, groups } = fields
  const names = table.fields.map((field) => field.name)
  const readableFields = names.filter((name) =>
    isFieldReadableByCaller(app, table.name, { role, groups }, name)
  )
  if (!writes) return { readableFields }
  const proposed = Object.fromEntries(names.map((name) => [name, true]))
  const refused = new Set(forbiddenWriteFields(app, table.name, { role, groups }, proposed))
  return { readableFields, writableFields: names.filter((name) => !refused.has(name)) }
}

/** The part of the caller the table-level grant reads. */
export type GrantCaller = Pick<AuthorizationCaller, 'effectiveRoles' | 'allTables' | 'signedOut'>

/**
 * Whether the caller's effective roles pass the table-level grant for `op`:
 * the inheritance- and override-aware evaluators, run over the account role,
 * the `group:<name>` memberships and the `user_access` roles. So a row-level
 * rule only ever NARROWS what the table grants. Admin always passes.
 */
export const tableGrantAdmits = (
  table: Table | undefined,
  op: RowLevelOperation,
  caller: GrantCaller
): boolean => {
  const { effectiveRoles, allTables } = caller
  if (op === 'read') return judgeTableReadGrant(table, caller, allTables)._tag === 'Allowed'
  if (op === 'create') return hasCreatePermissionForRoles(table, effectiveRoles, allTables)
  if (op === 'write') return hasUpdatePermissionForRoles(table, effectiveRoles, allTables)
  return hasDeletePermissionForRoles(table, effectiveRoles, allTables)
}

/**
 * The table-level verdict for `op` alone, for a door that judges no row rule
 * here (the table declares none, or the door judges the rows elsewhere).
 * Refused, the caller learns the table exists only if she may read it
 * (`Forbidden`, else `NotFound`); a refused read is always `NotFound`. Only
 * the verb's own grant is asked: a caller granted the verb but not the read
 * passes. `Allowed` carries no row rule (`no-rlp`).
 */
export const judgeTableGrant = (
  table: Table | undefined,
  op: RowLevelOperation,
  caller: GrantCaller
): Verdict => {
  if (op === 'read') return judgeTableReadGrant(table, caller, caller.allTables)
  if (tableGrantAdmits(table, op, caller)) return allowed('no-rlp')
  return tableGrantAdmits(table, 'read', caller) ? forbidden('grant') : NOT_FOUND
}

/**
 * May the caller read the table — and, given the row, this row? `Allowed`
 * carries the read rule projected for a list's query.
 */
export const authorizeRead = (
  table: Table | undefined,
  caller: AuthorizationCaller,
  row?: Row
): Effect.Effect<Verdict> =>
  Effect.sync((): Verdict => {
    const grant = judgeTableReadGrant(table, caller, caller.allTables)
    if (grant._tag !== 'Allowed') return grant
    const rlp = table?.rowLevelPermissions
    if (row !== undefined && !rowPassesRule(rlp, 'read', row, caller.current)) return NOT_FOUND
    const fields = table === undefined ? {} : fieldSetsOf(table, caller.fields, false)
    return allowed(projectRowRule(rlp, 'read', caller.current), fields)
  }).pipe(Effect.withSpan('tables.authorize-read'))

/**
 * May the caller create these rows? Refused by the grant, she learns the table
 * exists only if she may read it (`Forbidden`, else `NotFound`); a row outside
 * `create.when`, judged as it will be stored, is `Forbidden` by the row rule.
 */
export const authorizeCreate = (
  table: Table,
  caller: AuthorizationCaller,
  rows: readonly Row[]
): Effect.Effect<Verdict> =>
  Effect.sync((): Verdict => {
    const grant = judgeTableGrant(table, 'create', caller)
    if (grant._tag !== 'Allowed') return grant
    if (!rows.every((fields) => createAllowed(table, fields, caller.current))) {
      return forbidden('row-rule')
    }
    const fields = fieldSetsOf(table, caller.fields, true)
    return allowed(projectRowRule(table.rowLevelPermissions, 'create', caller.current), fields)
  }).pipe(Effect.withSpan('tables.authorize-create'))

/** The records an update or delete targets: one record, or a batch of ids. */
export type MutationTarget =
  | {
      readonly kind: 'record'
      readonly session: Pick<UserSession, 'userId'>
      readonly tableName: string
      readonly recordId: string
      /** The change an update proposes — `write.when` is checked on the row as written too. */
      readonly change?: Row
      /** The app, for a door whose read of the row refuses a table no single id addresses. */
      readonly app?: App
    }
  | {
      readonly kind: 'batch'
      readonly session: Pick<UserSession, 'userId'>
      readonly tableName: string
      readonly ids: readonly string[]
      /** Per-id change of a batch update — `write.when` is checked on each row as written. */
      readonly changes?: ReadonlyMap<string, Row>
      /** Judge trashed rows too — a restore's targets are by definition soft-deleted. */
      readonly includeDeleted?: boolean
    }

type MutationOp = 'write' | 'delete'

/**
 * The stored row the decision judges, `undefined` when missing or unreadable:
 * a fault is indistinguishable from a missing row by design (anti-enumeration).
 */
const storedRow = (
  target: Extract<MutationTarget, { readonly kind: 'record' }>
): Effect.Effect<Row | undefined, never, TableRepository> =>
  rawGetRecordProgram(
    target.session as UserSession,
    target.tableName,
    target.recordId,
    target.app
  ).pipe(
    Effect.map((row) => row ?? undefined),
    // effect-swallow: an unfetchable row answers as a missing one (S1 anti-enumeration)
    Effect.orElseSucceed(() => undefined)
  )

/**
 * One record: the read grant (before any row is read), the row itself, the
 * verb's grant, then the read rule and the verb's rule on the row as it stands
 * — and, for an update, `write.when` on the row as it would be written.
 */
const authorizeRecordMutation = (
  op: MutationOp,
  table: Table | undefined,
  caller: AuthorizationCaller,
  target: Extract<MutationTarget, { readonly kind: 'record' }>
): Effect.Effect<Verdict, never, TableRepository> => {
  if (!tableGrantAdmits(table, 'read', caller)) return Effect.succeed(NOT_FOUND)
  return Effect.map(storedRow(target), (row) => {
    if (!row || !table) return NOT_FOUND
    if (!tableGrantAdmits(table, op, caller)) return forbidden('grant')
    const rlp = table.rowLevelPermissions
    const admitted = existingRowWriteAllowed({
      rlp,
      op,
      // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
      existing: readStoredValues(table, row),
      change: target.change,
      ctx: caller.current,
    })
    if (!admitted) return NOT_FOUND
    return allowed(
      projectRowRule(rlp, op, caller.current),
      fieldSetsOf(table, caller.fields, op === 'write')
    )
  })
}

/** Whether every row of a batch update is still inside `write.when` as it would be written. */
const batchStaysInScope = (
  rows: readonly Row[],
  judged: {
    readonly op: MutationOp
    readonly table: Table
    readonly caller: AuthorizationCaller
    readonly changes: ReadonlyMap<string, Row> | undefined
  }
): boolean => {
  const { op, table, caller, changes } = judged
  if (op !== 'write' || changes === undefined) return true
  return rows.every((row) =>
    existingRowWriteAllowed({
      rlp: table.rowLevelPermissions,
      op,
      existing: readStoredValues(table, row),
      change: changes.get(String(row.id)),
      ctx: caller.current,
    })
  )
}

/**
 * A batch, judged whole: ONE query of the shape `id IN (…) AND <read rule> AND
 * <verb rule>`, whose result must hold every id asked for. A missing id — not
 * there, out of read scope or out of mutation scope — refuses the whole batch
 * with one `NotFound`: a partial answer would tell which ids exist.
 */
const authorizeBatchMutation = (
  op: MutationOp,
  table: Table | undefined,
  caller: AuthorizationCaller,
  target: Extract<MutationTarget, { readonly kind: 'batch' }>
): Effect.Effect<Verdict, never, TableRepository> => {
  if (!tableGrantAdmits(table, 'read', caller)) return Effect.succeed(NOT_FOUND)
  if (!tableGrantAdmits(table, op, caller)) return Effect.succeed(forbidden('grant'))
  if (!table) return Effect.succeed(NOT_FOUND)
  const rlp = table.rowLevelPermissions
  const fields = fieldSetsOf(table, caller.fields, op === 'write')
  if (!rlp || target.ids.length === 0) {
    return Effect.succeed(allowed(projectRowRule(rlp, op, caller.current), fields))
  }
  const filter = rowRuleBatchFilter(target.ids, rlp, caller.current, op)
  if (filter === 'empty') return Effect.succeed(NOT_FOUND)
  const { session, tableName, ids, changes, includeDeleted } = target
  const listed = rawListRecordsProgram(session as UserSession, tableName, filter, includeDeleted)
  return listed.pipe(
    Effect.map((rows): Verdict => {
      const allowedIds = new Set(rows.map((row) => String(row.id)))
      if (!ids.every((id) => allowedIds.has(String(id)))) return NOT_FOUND
      return batchStaysInScope(rows, { op, table, caller, changes })
        ? allowed(projectRowRule(rlp, op, caller.current), fields)
        : NOT_FOUND
    }),
    // effect-swallow: a batch the gate cannot list answers as missing rows (S1 anti-enumeration)
    Effect.orElseSucceed(() => NOT_FOUND)
  )
}

const authorizeMutation = (
  op: MutationOp,
  table: Table | undefined,
  caller: AuthorizationCaller,
  target: MutationTarget
): Effect.Effect<Verdict, never, TableRepository> =>
  target.kind === 'record'
    ? authorizeRecordMutation(op, table, caller, target)
    : authorizeBatchMutation(op, table, caller, target)

/** May the caller update the target record(s), with the change proposed? */
export const authorizeUpdate = (
  table: Table | undefined,
  caller: AuthorizationCaller,
  target: MutationTarget
): Effect.Effect<Verdict, never, TableRepository> =>
  authorizeMutation('write', table, caller, target).pipe(Effect.withSpan('tables.authorize-update'))

/** May the caller delete (or restore, judged as a delete) the target record(s)? */
export const authorizeDelete = (
  table: Table | undefined,
  caller: AuthorizationCaller,
  target: MutationTarget
): Effect.Effect<Verdict, never, TableRepository> =>
  authorizeMutation('delete', table, caller, target).pipe(
    Effect.withSpan('tables.authorize-delete')
  )

/**
 * May the caller comment on the table's records? Both table-level grants are
 * asked of her effective roles — read, then comment (`permissions.comment`, or
 * the table's `comments` block where none is declared) — and either refusal is
 * `NotFound`: a surface she may not comment on is not discoverable through the
 * comment routes (S1). Whether the RECORD is hers to read is the read verdict's
 * question, asked by the door once the table passes. A signed-out commenter is
 * judged on the roles her request resolved, as every comment route judges her;
 * whether she may post at all is the table's comment moderation, asked by the
 * door.
 */
export const authorizeComment = (
  table: Table | undefined,
  caller: Pick<AuthorizationCaller, 'effectiveRoles' | 'allTables'>
): Verdict => {
  const { effectiveRoles, allTables } = caller
  if (table === undefined) return NOT_FOUND
  const admitted =
    forRoles('read')(table, effectiveRoles, allTables) &&
    forRoles('comment')(table, effectiveRoles, allTables)
  return admitted ? allowed('no-rlp') : NOT_FOUND
}
