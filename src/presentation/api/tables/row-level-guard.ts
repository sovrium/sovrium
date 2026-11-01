/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The records routes' row-level door: the HTTP adapter over the authorization
 * verdicts.
 *
 * The decision itself — who the caller is, whether the table's grant admits
 * her, which rows its `rowLevelPermissions` rule leaves her — is made by the
 * use-cases (`authorization-caller`, `authorize-record-verbs`). This module
 * resolves the caller on the request's services, asks the verdict, and maps it
 * to the response the route has always given:
 *   - `Allowed`   — `undefined`, the handler proceeds
 *   - `NotFound`  — 404 (S1 anti-enumeration)
 *   - `Forbidden` — 404 as well: a refused update, delete or create is not
 *     told apart from a missing record on these routes
 */

import { Effect } from 'effect'
import {
  resolveAuthorizationCaller,
  resolveRowRuleCaller,
  type AuthorizationCaller,
  type RequestCaller,
} from '@/application/use-cases/tables/permissions/authorization-caller'
import {
  authorizeCreate,
  authorizeDelete,
  authorizeUpdate,
  tableGrantAdmits,
  type GrantCaller,
  type Verdict,
} from '@/application/use-cases/tables/permissions/authorize-record-verbs'
import { tableEffectiveRoles, getUserAccessRoles } from '@/application/use-cases/tables/user-groups'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  projectRowRule,
  type RowRuleClause,
} from '@/domain/models/app/tables/row-level-rule-projection-service'
import {
  rowPassesRule,
  type RowLevelOperation,
} from '@/domain/models/app/tables/row-level-write-decision-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from './response-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'
import type { RowLevelPermissions } from '@/domain/models/app/tables/permissions'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'
import type { Context } from 'hono'

export type { RowLevelOperation }

/** Who is asking: the account role and the caller's group names, as the table middleware resolved them. */
export type GuardCaller = RequestCaller

/** The caller a verdict judges (see `AuthorizationCaller`). */
export type RowLevelGuardContext = AuthorizationCaller

/** The caller for one table, on the request's ports (see `resolveAuthorizationCaller`). */
export const buildRowLevelGuardContext = resolveAuthorizationCaller

/** The caller for a table that declares row-level rules, else `undefined`. */
export const guardForTable = resolveRowRuleCaller

/**
 * Every `user_access` role the caller holds, failing closed on a lookup fault
 * (see `getUserAccessRoles`).
 */
export const fetchAccessRolesFailingClosed = (
  session: Pick<UserSession, 'userId'>
): Effect.Effect<readonly string[], never, DataSourceRepository> =>
  getUserAccessRoles(session.userId)

/**
 * The `user_access` roles the records route would add for this caller on any
 * of `tables` — fetched only when one of them declares row-level rules (the
 * only tables where the records route adds them) and the caller is signed in.
 */
export const resolveAccessRolesFor = (
  session: Pick<UserSession, 'userId'> | undefined,
  tables: readonly Pick<Table, 'rowLevelPermissions'>[]
): Effect.Effect<readonly string[], never, DataSourceRepository> => {
  if (session === undefined || isGuestSession(session.userId)) return Effect.succeed([])
  if (!tables.some((table) => table.rowLevelPermissions !== undefined)) return Effect.succeed([])
  return fetchAccessRolesFailingClosed(session)
}

/** True if the caller's effective roles pass the table-level grant for `op` (see `tableGrantAdmits`). */
export const passesTableRoleGate = (
  table: Table | undefined,
  op: RowLevelOperation,
  guard: GrantCaller
): boolean => tableGrantAdmits(table, op, guard)

/**
 * The records route's table-level gate on a table WITHOUT row-level rules:
 * {@link passesTableRoleGate} over the caller's account role and her
 * `group:<name>` memberships (`tableEffectiveRoles`) — no assignment role,
 * since assignments count only under row-level rules. Every door onto such a
 * table (the delete, the restore and its batch, the delete form, the record
 * button) asks this, so each admits exactly whom the records route admits.
 *
 * It judges WRITES only: a read asks the records route's read gate, which knows
 * whether the caller is signed in. `signedOut` is therefore not read here.
 */
export const passesUnguardedTableGate = (
  app: Pick<App, 'auth' | 'tables'>,
  table: Table | undefined,
  caller: GuardCaller,
  op: Exclude<RowLevelOperation, 'read'>
): boolean =>
  passesTableRoleGate(table, op, {
    effectiveRoles: tableEffectiveRoles(table, {
      role: caller.userRole,
      groups: caller.userGroups,
    }),
    allTables: app,
    signedOut: false,
  })

/** A table's rule for one operation, projected for a query (see `RowRuleClause`). */
export type ProjectedClauseResult = RowRuleClause

/** The row-level read rule, projected to a clause a list query ANDs on. */
export const projectReadPredicateClause = (
  rlp: RowLevelPermissions | undefined,
  ctx: CurrentUserContext
): ProjectedClauseResult => projectRowRule(rlp, 'read', ctx)

/** Whether a record is inside the table's rule for `op` (no rule, or an unrestricted caller, passes). */
export const recordPassesPredicate = (
  rlp: RowLevelPermissions | undefined,
  op: RowLevelOperation,
  record: Readonly<Record<string, unknown>>,
  ctx: CurrentUserContext
): boolean => rowPassesRule(rlp, op, record, ctx)

/* ────────────────────────────────────────────────────────────────────────────
 * Form / bulk / restore doors: the same verdicts, mapped to a response.
 * ──────────────────────────────────────────────────────────────────────── */

/** An update or delete verdict on these routes: every refusal is the missing-record 404. */
const mutationResponse = (c: Context, verdict: Verdict): Response | undefined =>
  verdict._tag === 'Allowed' ? undefined : notFound(c)

interface FormGateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext
  readonly op: 'write' | 'delete'
  /** The change an update proposes — `write.when` is checked on the row as written too. */
  readonly change?: Readonly<Record<string, unknown>>
}

/**
 * The single-record form-mode UPDATE / DELETE door: the verdict for one
 * record, `undefined` on pass, the 404 otherwise.
 */
export const formMutationGate = (
  input: FormGateInput
): Effect.Effect<Response | undefined, never, TableRepository> => {
  const { c, table, session, tableName, recordId, guard, op, change } = input
  const target = { kind: 'record', session, tableName, recordId, change } as const
  const verdict =
    op === 'write' ? authorizeUpdate(table, guard, target) : authorizeDelete(table, guard, target)
  return Effect.map(verdict, (judged) => mutationResponse(c, judged))
}

/**
 * The role gate of a restore under row-level rules: the caller reads the table
 * and holds its `delete` grant, over her effective roles (assignment roles
 * included). Asked before a batch body is decoded; the rows are judged by
 * {@link enforceRestoreGate} once the ids are known.
 */
export const restoreRoleGateAdmits = (table: Table | undefined, guard: GrantCaller): boolean =>
  passesTableRoleGate(table, 'read', guard) && passesTableRoleGate(table, 'delete', guard)

/**
 * The restore endpoints, single and batch. A restore answers to the `delete`
 * grant and to the `read.when` and `delete.when` rules — judged on the TRASHED
 * row. A row the caller's rules exclude answers exactly as a missing one (404)
 * and nothing leaves the trash; a batch is refused whole.
 */
export const enforceRestoreGate = (input: {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly ids: readonly string[]
  /** `undefined` for a table without row-level rules, which this gate admits. */
  readonly guard: RowLevelGuardContext | undefined
}): Effect.Effect<Response | undefined, never, TableRepository> => {
  const { guard } = input
  if (!guard) return Effect.undefined
  return enforceBulkMutationGate({ ...input, guard, op: 'delete', includeDeleted: true })
}

interface BulkGateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly ids: readonly string[]
  readonly guard: RowLevelGuardContext
  readonly op: 'write' | 'delete'
  /** Per-id change of a batch update — `write.when` is checked on each row as written. */
  readonly changes?: ReadonlyMap<string, Readonly<Record<string, unknown>>>
  /** Judge trashed rows too — a restore's targets are by definition soft-deleted. */
  readonly includeDeleted?: boolean
}

/**
 * The bulk door (form-bulk and JSON-batch): the batch verdict, judged whole in
 * one query. Any refusal is one 404 for the whole batch — a partial answer
 * would tell which ids exist and which are in scope.
 */
export const enforceBulkMutationGate = (
  input: BulkGateInput
): Effect.Effect<Response | undefined, never, TableRepository> => {
  const { c, table, session, tableName, ids, guard, op, changes, includeDeleted } = input
  const target = { kind: 'batch', session, tableName, ids, changes, includeDeleted } as const
  const verdict =
    op === 'write' ? authorizeUpdate(table, guard, target) : authorizeDelete(table, guard, target)
  return Effect.match(verdict, {
    onFailure: () => notFound(c),
    onSuccess: (judged) => mutationResponse(c, judged),
  })
}

/**
 * The bulk-create door. Each proposed row must satisfy `create.when`; a table
 * without row-level rules is not judged here. Refused by the grant, a caller
 * who may not read the table gets the plain 404, one who may gets the create
 * refusal; a row outside the rule gets the scope refusal — all 404s (S1).
 */
export function enforceBulkCreateGate(input: {
  readonly c: Context
  readonly table: Table | undefined
  readonly guard: RowLevelGuardContext
  readonly records: readonly Readonly<Record<string, unknown>>[]
}): Response | undefined {
  const { c, table, guard, records } = input
  if (!table?.rowLevelPermissions) return undefined
  return createVerdictResponse(c, Effect.runSync(authorizeCreate(table, guard, records)))
}

/**
 * A create verdict on the records routes: `undefined` on `Allowed`, the plain
 * 404 on `NotFound`, the create refusal for a caller refused by the grant who
 * may read the table, the scope refusal for a row outside `create.when`.
 */
export const createVerdictResponse = (c: Context, verdict: Verdict): Response | undefined => {
  if (verdict._tag === 'Allowed') return undefined
  if (verdict._tag === 'NotFound') return notFound(c)
  return verdict.refused === 'grant' ? forbiddenCreateResponse(c) : forbiddenCreateScopeResponse(c)
}
