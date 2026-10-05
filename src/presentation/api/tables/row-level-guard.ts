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
 *   1. Resolve the user's current-user context (Better Auth role + user_access
 *      roles + `group:<name>` memberships + assignments)
 *   2. Decide whether the user role is permitted by the table-level
 *      `permissions.{read,create,update,delete}` gate (overlay of Better
 *      Auth role, any user_access roles and every group the user belongs to)
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
import {
  loadCurrentUserContext,
  toSessionProjection,
  type SessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { rawListRecordsProgram } from '@/application/use-cases/tables/raw-list-program'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import {
  buildEffectiveRoles,
  getUserAccessRoles,
  tableEffectiveRoles,
} from '@/application/use-cases/tables/user-groups'
import { isAdminEquivalent } from '@/domain/models/app'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasReadPermissionForCaller,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import {
  isPredicateGroup,
  projectPredicateToFilter,
  projectWhenToFilter,
  type CurrentUserContext,
  type RowLevelFilterNode,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import {
  createAllowed,
  existingRowWriteAllowed,
  rowLevelRuleFor,
  rowPassesRule,
  type RowLevelOperation,
} from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { provideTableLive, runTableProgram } from '@/infrastructure/layers/table-layer'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from './response-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App, Table } from '@/domain/models/app'
import type { TableGateScope } from '@/domain/models/app/auth/permission-evaluator-service'
import type { RowLevelPermissions } from '@/domain/models/app/tables/permissions'
import type { Context } from 'hono'

export type { RowLevelOperation }

/**
 * Who is asking: the Better Auth role and the names of the groups the caller
 * belongs to (un-prefixed), both as the table middleware resolved them.
 */
export interface GuardCaller {
  readonly userRole: string
  readonly userGroups: readonly string[]
}

export interface RowLevelGuardContext {
  readonly current: CurrentUserContext
  readonly effectiveRoles: readonly string[]
  /**
   * The app the table-level gate is judged against: its tables are the set a
   * table's `inherit` resolves against, so the gate reads the EFFECTIVE grants,
   * and its role ladder names the top role the admin override admits beside
   * the built-in `admin`.
   */
  readonly allTables: TableGateScope
  /**
   * The caller is a visitor who is not signed in — decided from the session's
   * identity (the guest sentinel id), never from the name of her role.
   */
  readonly signedOut: boolean
}

/**
 * Build the guard context for a single request. The result captures the
 * Better Auth role, every group the user belongs to (as `group:<name>`), all
 * user_access roles for this user (across every scope-table), and the resolved
 * assignments map needed for predicate evaluation.
 *
 * `caller.userGroups` are the caller's group names as the table middleware already
 * resolved them for this request (`enrichUserRole`), so the guard adds no
 * group lookup of its own: a `group:<name>` grant admits the caller to a table
 * with a row-level rule exactly as it does to a table without one, and the
 * rule then narrows the rows.
 *
 * A visitor with no session reaches here under the placeholder `guest`
 * identity. That placeholder is never read as a person: her context is the
 * signed-out one (`signedOutContext`), in which no `$currentUser` value
 * resolves, so a rule naming the signed-in person matches no row for her — the
 * record gate's own answer for a reader who is not signed in, in the list's SQL
 * projection and in the single read's in-memory check alike.
 *
 * Returns an Effect because we need a database round-trip per
 * scope-table; the handler wraps this in `runTableProgram` /
 * `runEffect` like every other table operation.
 */
export const buildRowLevelGuardContext = (
  session: Pick<UserSession, 'userId'>,
  caller: GuardCaller,
  table: Pick<Table, 'rowLevelPermissions'>,
  app: Pick<App, 'auth' | 'tables'>
): Effect.Effect<RowLevelGuardContext, never, DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const { userRole, userGroups } = caller
    const projection: SessionProjection = toSessionProjection(session, {
      role: userRole,
      // A literal `admin` user is ALWAYS unrestricted (built-in-admin
      // conservatism — never a regression). Additionally, the app's RESOLVED
      // TOP custom role is admin-equivalent and bypasses row-level scoping,
      // bringing the records-API guard into parity with the session-establish
      // (`server.ts`) and MCP (`mcp/tool-call.ts`) paths. Mid-level custom
      // roles return false from `isAdminEquivalent` and stay scoped.
      isUnrestricted: isAdminEquivalent(userRole, app),
    })

    const current = yield* loadCurrentUserContext(projection, table.rowLevelPermissions)

    // Effective roles = Better Auth role + a `group:<name>` entry per group
    // membership + every user_access role this user holds. Used for the
    // table-level role gate (e.g. a user with
    // role='member' but a user_access row of role='customer-admin' should
    // pass `permissions.read = ['customer-admin']`).
    const userAccessRoles = yield* fetchAccessRolesFailingClosed(session)

    const effectiveRoles = mergeRoles(buildEffectiveRoles(userRole, userGroups), userAccessRoles)

    return { current, effectiveRoles, allTables: app, signedOut: isGuestSession(session.userId) }
  })

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
export const resolveAccessRolesFor = async (
  session: Pick<UserSession, 'userId'> | undefined,
  tables: readonly Pick<Table, 'rowLevelPermissions'>[]
): Promise<readonly string[]> => {
  if (session === undefined || isGuestSession(session.userId)) return []
  if (!tables.some((table) => table.rowLevelPermissions !== undefined)) return []
  return Effect.runPromise(provideTableLive(fetchAccessRolesFailingClosed(session)))
}

const mergeRoles = (primary: readonly string[], extras: readonly string[]): readonly string[] => {
  const set = new Set<string>([...primary, ...extras])
  return [...set]
}

/**
 * Convenience: returns the guard context when the table declares row-level
 * permissions, else `undefined`. Resolves the underlying Effect program with
 * `TableLive` so each handler can call this with a single `await`.
 */
export const resolveGuardForTable = async (
  session: Pick<UserSession, 'userId'>,
  caller: GuardCaller,
  table: Pick<Table, 'rowLevelPermissions'> | undefined,
  app: Pick<App, 'auth' | 'tables'>
): Promise<RowLevelGuardContext | undefined> => {
  if (!table?.rowLevelPermissions) return undefined
  return Effect.runPromise(
    provideTableLive(
      buildRowLevelGuardContext(
        session,
        caller,
        { rowLevelPermissions: table.rowLevelPermissions },
        app
      )
    )
  )
}

/**
 * True if any of the user's effective roles passes the table-level
 * permission for the given op.
 *
 * This is the records API's own gate on a table WITHOUT row-level rules —
 * the inheritance- and override-aware `has*PermissionForRoles` evaluators,
 * which the permission map reports too — run over the guard's effective
 * roles (Better Auth role, `group:<name>` memberships and `user_access`
 * roles). So a row-level rule only ever NARROWS what the table grants: an
 * operation a gating `permissions` block does not name stays refused, and a
 * table that `inherit`s or `override`s its grants is judged on the grants it
 * resolves to, exactly as without the rule. Admin always passes.
 */
export const passesTableRoleGate = (
  table: Table | undefined,
  op: RowLevelOperation,
  guard: Pick<RowLevelGuardContext, 'effectiveRoles' | 'allTables' | 'signedOut'>
): boolean => {
  const { effectiveRoles, allTables } = guard
  if (op === 'read') return hasReadPermissionForCaller(table, guard, allTables)
  if (op === 'create') return hasCreatePermissionForRoles(table, effectiveRoles, allTables)
  if (op === 'write') return hasUpdatePermissionForRoles(table, effectiveRoles, allTables)
  return hasDeletePermissionForRoles(table, effectiveRoles, allTables)
}

/**
 * The records route's table-level gate on a table WITHOUT row-level rules:
 * {@link passesTableRoleGate} over the one set of effective roles
 * (`tableEffectiveRoles`) — the caller's account role and her `group:<name>`
 * memberships, no assignment role, since assignments count only under
 * row-level rules. Every door onto such a table (the delete, the restore and
 * its batch, the delete form, the record button) asks this, so each admits
 * exactly whom the records route admits.
 *
 * It judges WRITES only: a read asks the records route's read gate, which knows
 * whether the caller is signed in. A write gate never consults that, so the
 * caller here carries no identity and `signedOut` is not read.
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

/** Filter clause emitted by `projectPredicateToFilter`. */
type ProjectedClause = {
  readonly field: string
  readonly operator: 'equals' | 'notEquals' | 'in'
  readonly value: unknown
}

/**
 * Result of projecting a row-level predicate for a single op.
 *
 * A composite predicate projects to a `RowLevelFilterNode` tree
 * (`{ and: … }` / `{ or: … }`). A single triple projects to a flat
 * `ProjectedClause` (or the `'empty'` short-circuit when its `in` list is
 * empty — only valid for a single triple; inside a group an empty `in` is
 * scoped to its branch via the SQL `IN (NULL)` rendering).
 */
export type ProjectedClauseResult =
  'bypass' | 'no-rlp' | 'empty' | undefined | ProjectedClause | RowLevelFilterNode

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
  const predicate = rowLevelRuleFor(rlp, op)
  if (!predicate) return 'no-rlp'
  if (ctx.isUnrestricted) return 'bypass'

  // Composite group: project to a nested AND/OR filter tree. An
  // empty `in` inside the tree is scoped to its own branch (rendered as
  // `IN (NULL)` by the SQL layer), so we do NOT apply the whole-predicate
  // `'empty'` short-circuit here.
  if (isPredicateGroup(predicate)) {
    const node = projectWhenToFilter(predicate, ctx)
    return node ?? undefined
  }

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
): boolean => rowPassesRule(rlp, op, record, ctx)

/* ────────────────────────────────────────────────────────────────────────────
 * Form / bulk / export Z-3 enforcement helpers (shared with row #6 audit C-1/C-2)
 *
 * The canonical record-{read,update,delete}-handlers run the predicate gate
 * inline because each call site has different control-flow needs. Form-mode,
 * bulk, and CSV-export endpoints reuse the SAME predicate semantics but
 * historically bypassed it entirely. These shared helpers fix that gap.
 * ──────────────────────────────────────────────────────────────────────── */

const NOT_FOUND_BODY = (c: Context): Response => notFound(c)

/**
 * S1 anti-enumeration: write-permission denials return 404, uniform with the
 * read-denial path. The `_action` parameter is kept on the signature for
 * call-site readability but no longer leaks into the response envelope.
 */
const FORBIDDEN_BODY = (c: Context, _action: 'update' | 'delete' | 'restore'): Response =>
  notFound(c)

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
  if (fetched._tag === 'Failure' || !fetched.success) return undefined
  return fetched.success
}

interface MutationPredicateInput {
  readonly c: Context
  readonly rlp: RowLevelPermissions | undefined
  readonly op: 'write' | 'delete'
  readonly row: Readonly<Record<string, unknown>>
  readonly change: Readonly<Record<string, unknown>> | undefined
  readonly ctx: CurrentUserContext
}

/**
 * Evaluate read.when + write.when (or delete.when) against a fetched row, and
 * write.when against the row as the change would leave it.
 * Returns the appropriate 404 response on failure, undefined on pass.
 */
function evaluateMutationPredicates(input: MutationPredicateInput): Response | undefined {
  const { c, rlp, op, row, change, ctx } = input
  return existingRowWriteAllowed({ rlp, op, existing: row, change, ctx })
    ? undefined
    : NOT_FOUND_BODY(c)
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
  const { c, table, session, tableName, recordId, guard, op, change } = input
  const action = op === 'write' ? 'update' : 'delete'

  if (!passesTableRoleGate(table, 'read', guard)) {
    return NOT_FOUND_BODY(c)
  }
  const row = await fetchRowForGate(session, tableName, recordId)
  if (!row || !table) return NOT_FOUND_BODY(c)
  if (!passesTableRoleGate(table, op, guard)) {
    return FORBIDDEN_BODY(c, action)
  }
  return evaluateMutationPredicates({
    c,
    rlp: table.rowLevelPermissions,
    op,
    // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
    row: readStoredValues(table, row),
    change,
    ctx: guard.current,
  })
}

/**
 * The role gate of a restore under row-level rules: the caller reads the table
 * and holds its `delete` grant, over her effective roles (assignment roles
 * included). Asked before a batch body is decoded; the rows are judged by
 * {@link enforceRestoreGate} once the ids are known.
 */
export const restoreRoleGateAdmits = (
  table: Table | undefined,
  guard: Pick<RowLevelGuardContext, 'effectiveRoles' | 'allTables' | 'signedOut'>
): boolean =>
  passesTableRoleGate(table, 'read', guard) && passesTableRoleGate(table, 'delete', guard)

/**
 * Z-3 enforcement for the restore endpoints, single and batch.
 *
 * Restore is a soft-delete-reverse, so it answers to the `delete` grant and
 * to the `read.when` and `delete.when` rules — evaluated on the TRASHED row,
 * which the ordinary reads skip. A row the caller's rules exclude answers
 * exactly as a missing one (404) and nothing leaves the trash; a batch is
 * refused whole.
 */
export async function enforceRestoreGate(input: {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly ids: readonly string[]
  /** `undefined` for a table without row-level rules, which this gate admits. */
  readonly guard: RowLevelGuardContext | undefined
}): Promise<Response | undefined> {
  const { guard } = input
  if (!guard) return undefined
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
  if (!passesTableRoleGate(table, 'read', guard)) {
    return NOT_FOUND_BODY(c)
  }
  if (!passesTableRoleGate(table, op, guard)) {
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
  const { c, table, session, tableName, ids, guard, op, includeDeleted } = input

  const roleGateError = checkBulkMutationRoleGate({ c, table, guard, op })
  if (roleGateError) return roleGateError

  const rlp = table?.rowLevelPermissions
  if (!rlp) return undefined
  if (ids.length === 0) return undefined

  const filter = buildBulkGateFilter(ids, rlp, guard.current, op)
  if (filter === 'empty') return NOT_FOUND_BODY(c)

  const fetched = await runTableProgram(
    rawListRecordsProgram(session as UserSession, tableName, filter, includeDeleted)
  )
  if (fetched._tag === 'Failure') return NOT_FOUND_BODY(c)

  // Compare allowed-set vs input-set: any id missing from the SQL result
  // is either non-existent OR out-of-scope read OR out-of-scope mutation.
  // All three collapse to the same atomic 404 — same contract as the
  // sequential reduce this replaces.
  const allowedIds = new Set(fetched.success.map((row) => String(row.id)))
  const allInScope = ids.every((id) => allowedIds.has(String(id)))
  if (!allInScope) return NOT_FOUND_BODY(c)
  return batchStaysInScope(fetched.success, input) ? undefined : NOT_FOUND_BODY(c)
}

/** Whether every row of a batch update is still inside `write.when` as it would be written. */
const batchStaysInScope = (
  rows: readonly Readonly<Record<string, unknown>>[],
  input: BulkGateInput
): boolean => {
  const { changes, op, table, guard } = input
  if (op !== 'write' || changes === undefined) return true
  return rows.every((row) =>
    existingRowWriteAllowed({
      rlp: table?.rowLevelPermissions,
      op,
      // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
      existing: readStoredValues(table, row),
      change: changes.get(String(row.id)),
      ctx: guard.current,
    })
  )
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

  if (!passesTableRoleGate(table, 'create', guard)) {
    if (!passesTableRoleGate(table, 'read', guard)) {
      return NOT_FOUND_BODY(c)
    }
    return forbiddenCreateResponse(c)
  }

  const allInScope = records.every((fields) => createAllowed(table, fields, guard.current))
  if (!allInScope) {
    return forbiddenCreateScopeResponse(c)
  }
  return undefined
}
