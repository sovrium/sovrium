/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import {
  collectAssignmentScopeTables,
  loadCurrentUserContext,
  toSessionProjection,
  type SessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { rawListRecordsProgram } from '@/application/use-cases/tables/raw-list-program'
import { isAdminEquivalent } from '@/domain/models/app'
import { hasPermission } from '@/domain/models/app/tables/permissions'
import {
  evaluateRecordAgainstPredicate,
  isPredicateGroup,
  projectPredicateToFilter,
  projectWhenToFilter,
  type CurrentUserContext,
  type RowLevelFilterNode,
} from '@/domain/validators/row-level-evaluator'
import { provideTableLive, runTableProgram } from '@/infrastructure/layers/table-layer'
import { forbiddenCreateResponse, forbiddenCreateScopeResponse } from '../response-helpers'
import type { Session, UserSession } from '@/application/ports/models/user-session'
import type { App, Table } from '@/domain/models/app'
import type { RowLevelPermissions, TablePermissions } from '@/domain/models/app/tables/permissions'
import type { Context } from 'hono'

export type RowLevelOperation = 'read' | 'write' | 'create' | 'delete'

export interface RowLevelGuardContext {
  readonly current: CurrentUserContext
  readonly effectiveRoles: readonly string[]
}

export const buildRowLevelGuardContext = (
  session: Pick<Session, 'userId'>,
  userRole: string,
  table: Pick<Table, 'rowLevelPermissions'>,
  app: Pick<App, 'auth'>
): Effect.Effect<RowLevelGuardContext, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const projection: SessionProjection = toSessionProjection(session, {
      role: userRole,
      isUnrestricted: userRole === 'admin' || isAdminEquivalent(userRole, app),
    })

    const scopeTables = collectAssignmentScopeTables(table.rowLevelPermissions)

    const current = yield* loadCurrentUserContext(projection, scopeTables)

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

export const resolveGuardForTable = async (
  session: Pick<Session, 'userId'>,
  userRole: string,
  table: Pick<Table, 'rowLevelPermissions'> | undefined,
  app: Pick<App, 'auth'>
): Promise<RowLevelGuardContext | undefined> => {
  if (!table?.rowLevelPermissions) return undefined
  return Effect.runPromise(
    provideTableLive(
      buildRowLevelGuardContext(
        session,
        userRole,
        { rowLevelPermissions: table.rowLevelPermissions },
        app
      )
    )
  )
}

export const passesTableRoleGate = (
  permissions: TablePermissions | undefined,
  op: RowLevelOperation,
  effectiveRoles: readonly string[]
): boolean => {
  if (effectiveRoles.includes('admin')) return true

  if (!permissions) {
    return effectiveRoles.some((role) => role !== 'viewer')
  }

  const key = mapOpToPermissionKey(op)
  const value = permissions[key] as TablePermissions[typeof key] | undefined

  if (value === undefined) {
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

type ProjectedClause = {
  readonly field: string
  readonly operator: 'equals' | 'notEquals' | 'in'
  readonly value: unknown
}

export type ProjectedClauseResult =
  | 'bypass'
  | 'no-rlp'
  | 'empty'
  | undefined
  | ProjectedClause
  | RowLevelFilterNode

const projectOpPredicateClause = (
  rlp: RowLevelPermissions | undefined,
  op: RowLevelOperation,
  ctx: CurrentUserContext
): ProjectedClauseResult => {
  const predicate = rlp ? predicateFor(rlp, op) : undefined
  if (!predicate) return 'no-rlp'
  if (ctx.isUnrestricted) return 'bypass'

  if (isPredicateGroup(predicate)) {
    const node = projectWhenToFilter(predicate, ctx)
    return node ?? undefined
  }

  const projected = projectPredicateToFilter(predicate, ctx)
  if (!projected) return undefined
  if (
    projected.operator === 'in' &&
    Array.isArray(projected.value) &&
    projected.value.length === 0
  ) {
    return 'empty'
  }
  return projected
}

export const projectReadPredicateClause = (
  rlp: RowLevelPermissions | undefined,
  ctx: CurrentUserContext
): ProjectedClauseResult => projectOpPredicateClause(rlp, 'read', ctx)

export const projectMutationPredicateClause = (
  rlp: RowLevelPermissions | undefined,
  op: 'write' | 'delete',
  ctx: CurrentUserContext
): ProjectedClauseResult => projectOpPredicateClause(rlp, op, ctx)

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
  return rlp.delete?.when
}

export const findAppTable = (app: App, tableName: string): Table | undefined =>
  app.tables?.find((t) => t.name === tableName)


const NOT_FOUND_BODY = (c: Context): Response =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

const FORBIDDEN_BODY = (c: Context, _action: 'update' | 'delete' | 'restore'): Response =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

interface FormGateInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: Pick<UserSession, 'userId'>
  readonly tableName: string
  readonly recordId: string
  readonly guard: RowLevelGuardContext
  readonly op: 'write' | 'delete'
}

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

function evaluateMutationPredicates(input: MutationPredicateInput): Response | undefined {
  const { c, rlp, op, row, ctx } = input
  if (!rlp) return undefined
  if (rlp.read?.when && !recordPassesPredicate(rlp, 'read', row, ctx)) return NOT_FOUND_BODY(c)
  if (!recordPassesPredicate(rlp, op, row, ctx)) return NOT_FOUND_BODY(c)
  return undefined
}

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

  if (readClause === 'empty' || readClause === undefined) return 'empty'
  if (mutationClause === 'empty' || mutationClause === undefined) return 'empty'

  const idClause = { field: 'id', operator: 'in', value: ids } as const
  const isLiteralClause = (clause: ProjectedClauseResult): clause is ProjectedClause =>
    clause !== 'no-rlp' && clause !== 'bypass' && clause !== 'empty' && clause !== undefined
  const extraClauses = [readClause, mutationClause].filter(isLiteralClause)

  return { and: [idClause, ...extraClauses] }
}

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

  const allowedIds = new Set(fetched.right.map((row) => String(row.id)))
  const allInScope = ids.every((id) => allowedIds.has(String(id)))
  return allInScope ? undefined : NOT_FOUND_BODY(c)
}

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
