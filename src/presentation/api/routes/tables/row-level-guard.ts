/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Z-3 row-level permission guard for the record CRUD handlers.
 *
 * Provides a single entry point each handler calls to:
 *   1. Resolve the user's current-user context (Better Auth role + user_access roles + assignments)
 *   2. Decide whether the user role is permitted by the table-level
 *      `permissions.{read,create,update,delete}` gate (overlay of Better
 *      Auth role and any user_access roles)
 *   3. Project / evaluate the relevant `rowLevelPermissions.<op>.when`
 *      predicate
 *
 * The guard returns a typed result object the handler maps to the
 * appropriate HTTP outcome:
 *   - 200/201 — pass
 *   - 404      — out-of-scope read/write/delete (enumeration safety)
 *   - 403      — out-of-scope create or table-level role gate violation
 */

import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/data-source-repository'
import {
  collectAssignmentScopeTables,
  loadCurrentUserContext,
  toSessionProjection,
  type SessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { rawListRecordsProgram } from '@/application/use-cases/tables/raw-list-program'
import { hasPermission } from '@/domain/models/app/tables/permissions'
import {
  evaluateRecordAgainstPredicate,
  projectPredicateToFilter,
  type CurrentUserContext,
} from '@/domain/validators/row-level-evaluator'
import { provideTableLive, runTableProgram } from '@/infrastructure/layers/table-layer'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from './response-helpers'
import type { Session, UserSession } from '@/application/ports/models/user-session'
import type { App, Table } from '@/domain/models/app'
import type { RowLevelPermissions, TablePermissions } from '@/domain/models/app/tables/permissions'
import type { Context } from 'hono'

/**
 * The four CRUD operations the row-level layer gates.
 */
export type RowLevelOperation = 'read' | 'write' | 'create' | 'delete'

export interface RowLevelGuardContext {
  readonly current: CurrentUserContext
  readonly effectiveRoles: readonly string[]
}

/**
 * Build the guard context for a single request. The result captures the
 * Better Auth role, all user_access roles for this user (across every
 * scope-table), and the resolved assignments map needed for predicate
 * evaluation.
 *
 * Returns an Effect because we need a database round-trip per
 * scope-table; the handler wraps this in `runTableProgram` /
 * `runEffect` like every other table operation.
 */
export const buildRowLevelGuardContext = (
  session: Pick<Session, 'userId'>,
  userRole: string,
  table: Pick<Table, 'rowLevelPermissions'>
): Effect.Effect<RowLevelGuardContext, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const projection: SessionProjection = toSessionProjection(session, {
      role: userRole,
      isUnrestricted: userRole === 'admin',
    })

    const scopeTables = collectAssignmentScopeTables(table.rowLevelPermissions)

    const current = yield* loadCurrentUserContext(projection, scopeTables)

    // Effective roles = Better Auth role + every user_access role this user
    // holds. Used for the table-level role gate (e.g. a user with
    // role='member' but a user_access row of role='customer-admin' should
    // pass `permissions.read = ['customer-admin']`).
    const userAccessRoles = yield* repo
      .fetchUserAccessRoles(session.userId)
      .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))

    const effectiveRoles = mergeRoles(userRole, userAccessRoles)

    return { current, effectiveRoles }
  })

const mergeRoles = (primary: string, extras: readonly string[]): readonly string[] => {
  const set = new Set<string>([primary, ...extras])
  return [...set]
}

/**
 * Convenience: returns the guard context when the table declares row-level
 * permissions, else `undefined`. Resolves the underlying Effect program with
 * `TableLive` so each handler can call this with a single `await`.
 */
export const resolveGuardForTable = async (
  session: Pick<Session, 'userId'>,
  userRole: string,
  table: Pick<Table, 'rowLevelPermissions'> | undefined
): Promise<RowLevelGuardContext | undefined> => {
  if (!table?.rowLevelPermissions) return undefined
  return Effect.runPromise(
    provideTableLive(
      buildRowLevelGuardContext(session, userRole, {
        rowLevelPermissions: table.rowLevelPermissions,
      })
    )
  )
}

/**
 * True if any of the user's effective roles passes the table-level
 * permission for the given op. `'all'` and `'authenticated'` short-circuit
 * since both implicitly grant access. Admin roles always pass.
 */
export const passesTableRoleGate = (
  permissions: TablePermissions | undefined,
  op: RowLevelOperation,
  effectiveRoles: readonly string[]
): boolean => {
  // Better Auth admin (Z-1 `isUnrestricted`) always passes the role gate
  // regardless of the table's permissions block.
  if (effectiveRoles.includes('admin')) return true

  // No permissions block at all — fall back to the existing default behaviour
  // (admins+members allowed, viewers denied) handled by `hasReadPermission`
  // in the canonical evaluator. We re-encode that here to avoid round-tripping.
  if (!permissions) {
    return effectiveRoles.some((role) => role !== 'viewer')
  }

  const key = mapOpToPermissionKey(op)
  const value = permissions[key] as TablePermissions[typeof key] | undefined

  if (value === undefined) {
    // Operation not declared — same default as above.
    return effectiveRoles.some((role) => role !== 'viewer')
  }

  return effectiveRoles.some((role) => hasPermission(value, role))
}

const mapOpToPermissionKey = (op: RowLevelOperation): keyof TablePermissions => {
  if (op === 'read') return 'read'
  if (op === 'create') return 'create'
  if (op === 'write') return 'update'
  return 'delete'
}

/** Filter clause emitted by `projectPredicateToFilter`. */
type ProjectedClause = {
  readonly field: string
  readonly operator: 'equals' | 'notEquals' | 'in'
  readonly value: unknown
}

/** Result of projecting a row-level predicate for a single op. */
export type ProjectedClauseResult = 'bypass' | 'no-rlp' | 'empty' | undefined | ProjectedClause

/**
 * Shared projection core. Handles the admin bypass + missing-predicate +
 * empty-`in` sentinel logic that both `projectReadPredicateClause` and
 * `projectMutationPredicateClause` need.
 */
const projectOpPredicateClause = (
  rlp: RowLevelPermissions | undefined,
  op: RowLevelOperation,
  ctx: CurrentUserContext
): ProjectedClauseResult => {
  const predicate = rlp ? predicateFor(rlp, op) : undefined
  if (!predicate) return 'no-rlp'
  if (ctx.isUnrestricted) return 'bypass'
  const projected = projectPredicateToFilter(predicate, ctx)
  if (!projected) return undefined
  // Empty `in` list means "match nothing"; surface as a sentinel so the
  // caller skips the SQL query (some drivers reject `IN ()` outright).
  if (
    projected.operator === 'in' &&
    Array.isArray(projected.value) &&
    projected.value.length === 0
  ) {
    return 'empty'
  }
  return projected
}

/**
 * Project the row-level read predicate to a single filter clause that can
 * be ANDed onto the table-list query.
 *
 * Returns:
 *  - `'bypass'` when the user is an admin (no row-level scoping applied)
 *  - `'no-rlp'` when the table has no row-level read predicate
 *  - `'empty'` when the predicate resolves to "match nothing" (e.g. `in []`);
 *    the caller should short-circuit to an empty result without querying
 *  - `{ field, operator, value }` clause otherwise
 *  - `undefined` when projection failed (caller should return zero rows)
 */
export const projectReadPredicateClause = (
  rlp: RowLevelPermissions | undefined,
  ctx: CurrentUserContext
): ProjectedClauseResult => projectOpPredicateClause(rlp, 'read', ctx)

/**
 * Project the row-level write/delete predicate to a single filter clause.
 * Mirrors `projectReadPredicateClause` for the mutation path. Used by
 * `enforceBulkMutationGate` to translate per-row evaluation into a single
 * batched SQL round-trip (see Wave-1 follow-up debt closure).
 */
export const projectMutationPredicateClause = (
  rlp: RowLevelPermissions | undefined,
  op: 'write' | 'delete',
  ctx: CurrentUserContext
): ProjectedClauseResult => projectOpPredicateClause(rlp, op, ctx)

/**
 * Evaluate a record against the predicate for the given op. Returns true
 * when the record is in scope (or no predicate / admin bypass), false
 * otherwise.
 */
export const recordPassesPredicate = (
  rlp: RowLevelPermissions | undefined,
  op: RowLevelOperation,
  record: Readonly<Record<string, unknown>>,
  ctx: CurrentUserContext
): boolean => {
  if (!rlp) return true
  if (ctx.isUnrestricted) return true

  const predicate = predicateFor(rlp, op)
  if (!predicate) return true

  return evaluateRecordAgainstPredicate(record, predicate, ctx)
}

const predicateFor = (rlp: RowLevelPermissions, op: RowLevelOperation) => {
  if (op === 'read') return rlp.read?.when
  if (op === 'write') return rlp.write?.when
  if (op === 'create') return rlp.create?.when
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- `delete` is a property of the RowLevelPermissions struct, not a Drizzle query.
  return rlp.delete?.when
}

/**
 * Convenience: locate the active table on `app` by name.
 * @public
 */
export const findAppTable = (app: App, tableName: string): Table | undefined =>
  app.tables?.find((t) => t.name === tableName)

/* ────────────────────────────────────────────────────────────────────────────
 * Form / bulk / export Z-3 enforcement helpers (shared with row #6 audit C-1/C-2)
 *
 * The canonical record-{read,update,delete}-handlers run the predicate gate
 * inline because each call site has different control-flow needs. Form-mode,
 * bulk, and CSV-export endpoints reuse the SAME predicate semantics but
 * historically bypassed it entirely. These shared helpers fix that gap.
 * ──────────────────────────────────────────────────────────────────────── */

const NOT_FOUND_BODY = (c: Context): Response =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

const FORBIDDEN_BODY = (c: Context, action: 'update' | 'delete' | 'restore'): Response =>
  c.json(
    {
      success: false,
      message: `You do not have permission to ${action} records in this table`,
      code: 'FORBIDDEN',
    },
    403
  )

interface FormGateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext
  readonly op: 'write' | 'delete'
}

/**
 * Fetch a row for predicate evaluation. Returns `undefined` when missing —
 * caller maps to 404. Centralised so the helpers below are uniform.
 */
async function fetchRowForGate(
  session: Pick<UserSession, 'userId'>,
  tableName: string,
  recordId: string
): Promise<Readonly<Record<string, unknown>> | undefined> {
  const fetched = await runTableProgram(
    rawGetRecordProgram(session as UserSession, tableName, recordId)
  )
  if (fetched._tag === 'Left' || !fetched.right) return undefined
  return fetched.right
}

interface MutationPredicateInput {
  readonly c: Context
  readonly rlp: RowLevelPermissions | undefined
  readonly op: 'write' | 'delete'
  readonly row: Readonly<Record<string, unknown>>
  readonly ctx: CurrentUserContext
}

/**
 * Evaluate read.when + write.when (or delete.when) against a fetched row.
 * Returns the appropriate 404 response on failure, undefined on pass.
 */
function evaluateMutationPredicates(input: MutationPredicateInput): Response | undefined {
  const { c, rlp, op, row, ctx } = input
  if (!rlp) return undefined
  if (rlp.read?.when && !recordPassesPredicate(rlp, 'read', row, ctx)) return NOT_FOUND_BODY(c)
  if (!recordPassesPredicate(rlp, op, row, ctx)) return NOT_FOUND_BODY(c)
  return undefined
}

/**
 * Z-3 enforcement for single-record form-mode (UPDATE / DELETE) endpoints.
 *
 * Mirrors the canonical delete handler ordering exactly:
 *   1. read role-gate (404 if no read access — enumeration safety)
 *   2. fetch the existing row (404 on miss)
 *   3. evaluate read.when (404 on out-of-scope read)
 *   4. write/delete role-gate (403 — user can read but not modify)
 *   5. evaluate write.when / delete.when (404 on out-of-scope mutation)
 *
 * Returns `undefined` on pass, a `Response` to short-circuit otherwise.
 */
export async function enforceFormMutationGate(input: FormGateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId, guard, op } = input
  const action = op === 'write' ? 'update' : 'delete'

  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return NOT_FOUND_BODY(c)
  }
  const row = await fetchRowForGate(session, tableName, recordId)
  if (!row || !table) return NOT_FOUND_BODY(c)
  if (!passesTableRoleGate(table.permissions, op, guard.effectiveRoles)) {
    return FORBIDDEN_BODY(c, action)
  }
  return evaluateMutationPredicates({
    c,
    rlp: table.rowLevelPermissions,
    op,
    row,
    ctx: guard.current,
  })
}

/**
 * Z-3 enforcement for the restore endpoint.
 *
 * Restore is a soft-delete-reverse and the predicate semantics match
 * `delete`: the user must have been entitled to the row before it was
 * soft-deleted. Returns 404 (read miss) or 403 (delete role gate fail).
 *
 * Restore needs `includeDeleted: true` because by definition the row is
 * soft-deleted; we therefore hit the repository directly via a raw program
 * that includes the `_deleted` rows.
 */
export async function enforceRestoreGate(input: {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext
}): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId, guard } = input

  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return NOT_FOUND_BODY(c)
  }

  if (!passesTableRoleGate(table?.permissions, 'delete', guard.effectiveRoles)) {
    return FORBIDDEN_BODY(c, 'restore')
  }

  // For row-level scoping we still want to verify the row exists & is in
  // scope. We fetch via raw program; if the program returns null because
  // the row is soft-deleted, runTableProgram leaves the row check to the
  // restore use-case (which surfaces the canonical 404 if the row is
  // truly missing). The predicate check below only fires when we can
  // observe the row.
  if (!table?.rowLevelPermissions) return undefined
  const fetched = await runTableProgram(
    rawGetRecordProgram(session as UserSession, tableName, recordId)
  )
  if (
    fetched._tag === 'Right' &&
    fetched.right &&
    !recordPassesPredicate(table.rowLevelPermissions, 'read', fetched.right, guard.current)
  ) {
    return NOT_FOUND_BODY(c)
  }

  return undefined
}

interface BulkGateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly ids: readonly string[]
  readonly guard: RowLevelGuardContext
  readonly op: 'write' | 'delete'
}

/**
 * Compose the WHERE clauses for the bulk-gate batch query.
 *
 * Returns:
 *  - `'empty'` when the row-level read OR write/delete predicate already
 *    resolves to "match nothing" (or to an unresolved reference). The
 *    caller maps this to an atomic 404 without issuing the SQL query.
 *  - `{ and: [...] }` filter otherwise: an `id IN (ids)` clause merged
 *    with whatever row-level read/mutation clauses apply.
 */
function buildBulkGateFilter(
  ids: readonly string[],
  rlp: RowLevelPermissions,
  ctx: CurrentUserContext,
  op: 'write' | 'delete'
):
  | 'empty'
  | {
      readonly and: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    } {
  const readClause = projectReadPredicateClause(rlp, ctx)
  const mutationClause = projectMutationPredicateClause(rlp, op, ctx)

  // Either projection failing safely collapses to "match nothing" — the
  // sequential evaluator returned 404 in those cases, so we mirror that
  // contract via the empty-set sentinel.
  if (readClause === 'empty' || readClause === undefined) return 'empty'
  if (mutationClause === 'empty' || mutationClause === undefined) return 'empty'

  // Compose the AND clauses immutably. Sentinels ('no-rlp', 'bypass') are
  // dropped — they impose no extra constraint beyond `id IN (ids)`.
  const idClause = { field: 'id', operator: 'in', value: ids } as const
  const isLiteralClause = (clause: ProjectedClauseResult): clause is ProjectedClause =>
    clause !== 'no-rlp' && clause !== 'bypass' && clause !== 'empty' && clause !== undefined
  const extraClauses = [readClause, mutationClause].filter(isLiteralClause)

  return { and: [idClause, ...extraClauses] }
}

/**
 * Pre-check the role-gate side of the bulk-mutation contract. Returns a
 * 404/403 response when the user fails the role gate for read or for the
 * mutation, or `undefined` to indicate the row-level / SQL phase should
 * proceed. Extracted to keep `enforceBulkMutationGate` under the
 * cyclomatic-complexity limit.
 */
function checkBulkMutationRoleGate(input: {
  readonly c: Context
  readonly table: Table | undefined
  readonly guard: RowLevelGuardContext
  readonly op: 'write' | 'delete'
}): Response | undefined {
  const { c, table, guard, op } = input
  if (!passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) {
    return NOT_FOUND_BODY(c)
  }
  if (!passesTableRoleGate(table?.permissions, op, guard.effectiveRoles)) {
    return FORBIDDEN_BODY(c, op === 'write' ? 'update' : 'delete')
  }
  if (!table) return NOT_FOUND_BODY(c)
  return undefined
}

/**
 * Z-3 enforcement for bulk operations (form-bulk and JSON-batch).
 *
 * Strategy: instead of fetching each id sequentially (N round-trips), we
 * issue a SINGLE `listRecords` query of the shape
 *   `id IN (…) AND <read.when clause> AND <write/delete.when clause>`
 * and compare the returned id set against the input id set. Any input id
 * NOT in the returned set is either missing, out-of-scope read, or
 * out-of-scope mutation — atomic 404.
 *
 * Failure modes (all atomic — never partial):
 *   - read role-gate fail → 404 for the whole batch
 *   - write/delete role-gate fail → 403 for the whole batch
 *   - any input id missing from the allowed-set → 404 (no partial success)
 *
 * Atomic-fail is the spec contract: returning partial success would be
 * an enumeration oracle (attacker learns which ids exist + which are in
 * scope by which entries succeed/fail).
 */
export async function enforceBulkMutationGate(input: BulkGateInput): Promise<Response | undefined> {
  const { c, table, session, tableName, ids, guard, op } = input

  const roleGateError = checkBulkMutationRoleGate({ c, table, guard, op })
  if (roleGateError) return roleGateError

  const rlp = table?.rowLevelPermissions
  if (!rlp) return undefined
  if (ids.length === 0) return undefined

  const filter = buildBulkGateFilter(ids, rlp, guard.current, op)
  if (filter === 'empty') return NOT_FOUND_BODY(c)

  const fetched = await runTableProgram(
    rawListRecordsProgram(session as UserSession, tableName, filter)
  )
  if (fetched._tag === 'Left') return NOT_FOUND_BODY(c)

  // Compare allowed-set vs input-set: any id missing from the SQL result
  // is either non-existent OR out-of-scope read OR out-of-scope mutation.
  // All three collapse to the same atomic 404 — same contract as the
  // sequential reduce this replaces.
  const allowedIds = new Set(fetched.right.map((row) => String(row.id)))
  const allInScope = ids.every((id) => allowedIds.has(String(id)))
  return allInScope ? undefined : NOT_FOUND_BODY(c)
}

/**
 * Z-3 enforcement for the bulk-create body.
 *
 * For each row in the batch the proposed fields must satisfy the
 * `create.when` predicate. Out-of-scope create returns 403 (matches
 * single-record create — admins/members get 403, lacking-read users
 * collapse to 404 via the role-gate).
 */
export function enforceBulkCreateGate(input: {
  readonly c: Context
  readonly table: Table | undefined
  readonly guard: RowLevelGuardContext
  readonly records: readonly Readonly<Record<string, unknown>>[]
}): Response | undefined {
  const { c, table, guard, records } = input
  if (!table?.rowLevelPermissions) return undefined

  if (!passesTableRoleGate(table.permissions, 'create', guard.effectiveRoles)) {
    if (!passesTableRoleGate(table.permissions, 'read', guard.effectiveRoles)) {
      return NOT_FOUND_BODY(c)
    }
    return forbiddenCreateResponse(c)
  }

  const allInScope = records.every((fields) =>
    recordPassesPredicate(table.rowLevelPermissions, 'create', fields, guard.current)
  )
  if (!allInScope) {
    return forbiddenCreateScopeResponse(c)
  }
  return undefined
}
