/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a NAMED CALLER may write a record — the records API's write gates,
 * answered for a user id rather than for an HTTP request.
 *
 * An automation someone starts by hand (a manual trigger, a table button, an
 * MCP action template or automation tool) writes as that person, so its record
 * actions must answer to the same rules the person would meet on the records
 * API: the table's grant for the operation (and for reading it — a row the
 * caller cannot read is not disclosed), the row-level rules on the row as it
 * stands and as it would be written, and the field write audiences. The pure
 * decisions live in the domain (`row-level-write-decision-service`,
 * `field-write-permission-service`, `permission-evaluator-service`); this
 * program only gathers what they read — the caller's role, groups, `user_access`
 * roles and assignments, and the stored row — through the repository ports.
 *
 * It DECLARES its requirements (standing rule E1): the run that calls it
 * already holds the automation runtime's services.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  getUserAccessRoles,
  getUserGroups,
  tableEffectiveRoles,
} from '@/application/use-cases/tables/user-groups'
import {
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasReadPermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { toGrantingRole } from '@/domain/models/app/auth/roles/granting-role-service'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import {
  createAllowed,
  existingRowWriteAllowed,
} from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { loadCurrentUserContext, rowRuleScopeOf } from './row-level-enforcement'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App, Table } from '@/domain/models/app'
import type { CurrentUserContext } from '@/domain/models/app/tables/row-level-evaluator-service'

/** One record write a caller asks for. */
export type CallerWriteRequest =
  | {
      readonly op: 'create'
      readonly tableName: string
      readonly fields: Readonly<Record<string, unknown>>
    }
  | {
      readonly op: 'update'
      readonly tableName: string
      readonly recordId: string
      readonly change: Readonly<Record<string, unknown>>
    }
  | { readonly op: 'delete'; readonly tableName: string; readonly recordId: string }

type Requirements = AuthRepository | DataSourceRepository | TableRepository

/** Everything the decisions read about the caller, gathered once per check. */
export interface CallerIdentity {
  readonly role: string
  /** Group names the caller belongs to (un-prefixed), for `group:` field grants. */
  readonly groups: readonly string[]
  /** Every role the caller's `user_access` assignments give her, on any table. */
  readonly accessRoles: readonly string[]
  readonly effectiveRoles: readonly string[]
  readonly ctx: CurrentUserContext
}

/**
 * Who the caller is, for the read and write decisions alike — or `undefined`
 * when there is no caller to act as: an account that no longer exists or has
 * been banned since the run started carries no standing, exactly as the
 * records API would refuse it a session.
 */
export const loadCallerIdentity = (
  app: App,
  userId: string,
  table: Table
): Effect.Effect<CallerIdentity | undefined, never, Requirements> =>
  Effect.gen(function* () {
    const auth = yield* AuthRepository
    // effect-swallow: an account whose standing cannot be confirmed is treated as no caller — it can only NARROW what passes.
    const active = yield* auth.isActiveUser(userId).pipe(Effect.orElseSucceed(() => false))
    if (!active) return undefined
    // The role decides every grant, so a failed role lookup refuses the write
    // outright rather than guessing one — a guess could only widen access.
    const roleLookup = yield* Effect.result(auth.getUserRole(userId))
    if (roleLookup._tag === 'Failure') return undefined
    // The role the records API would see: an absent, empty or undeclared one
    // grants nothing (`toGrantingRole`), never the `member` default.
    const role = toGrantingRole(roleLookup.success, app)
    const groups = yield* getUserGroups(userId)
    // The records route's own lookup: fails closed, and logs the fault.
    const accessRoles = yield* getUserAccessRoles(userId)
    // The context reads her email itself, the one lookup every door shares.
    const ctx = yield* loadCurrentUserContext(
      { userId, role, isUnrestricted: isAdminEquivalent(role, app) },
      table.rowLevelPermissions,
      rowRuleScopeOf(table, app.tables)
    )
    // The records route's own effective roles: assignment roles count only on
    // a table with row-level rules, exactly as they do there.
    const effectiveRoles = tableEffectiveRoles(table, { role, groups, accessRoles })
    return { role, groups, accessRoles, effectiveRoles, ctx }
  }).pipe(Effect.withSpan('tables.load-caller-identity'))

/** The table-level grant for the operation, behind the grant to read the table at all. */
const passesTableGrant = (
  app: App,
  table: Table,
  op: CallerWriteRequest['op'],
  roles: readonly string[]
): boolean => {
  if (op === 'create') return hasCreatePermissionForRoles(table, roles, app)
  if (!hasReadPermissionForRoles(table, roles, app)) return false
  return op === 'update'
    ? hasUpdatePermissionForRoles(table, roles, app)
    : hasDeletePermissionForRoles(table, roles, app)
}

/** The stored row an update or delete targets, read unscoped so the rules can judge it. */
const fetchRow = (
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<Readonly<Record<string, unknown>> | undefined, never, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const row = yield* repo.getRecord(session, tableName, recordId).pipe(
      // effect-swallow: a row that cannot be read is refused as a missing one — the write it guards never happens.
      Effect.orElseSucceed(() => undefined)
    )
    return row ?? undefined
  })

/** Whether the row-level rules and field audiences admit the request. */
const passesRowAndFieldRules = (input: {
  readonly app: App
  readonly table: Table
  readonly request: CallerWriteRequest
  readonly identity: CallerIdentity
  readonly session: Readonly<UserSession>
}): Effect.Effect<boolean, never, TableRepository> =>
  Effect.gen(function* () {
    const { app, table, request, identity, session } = input
    const rlp = table.rowLevelPermissions
    if (request.op === 'create') {
      return (
        createAllowed(table, request.fields, identity.ctx) &&
        forbiddenWriteFields(app, table.name, identity, request.fields).length === 0
      )
    }
    const stored = yield* fetchRow(session, table.name, request.recordId)
    if (stored === undefined) return false
    // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
    const existing = readStoredValues(table, stored)
    if (request.op === 'delete') {
      return existingRowWriteAllowed({ rlp, op: 'delete', existing, ctx: identity.ctx })
    }
    return (
      existingRowWriteAllowed({
        rlp,
        op: 'write',
        existing,
        change: request.change,
        ctx: identity.ctx,
      }) && forbiddenWriteFields(app, table.name, identity, request.change).length === 0
    )
  })

/**
 * Whether the caller the session names may perform each of `requests` — all on
 * ONE table — answered in order, with the caller's identity gathered once for
 * the whole set: a write that reaches many rows (an assistant's bulk update or
 * delete, a hand-started automation's batch) judges each row exactly as a
 * single write of it would be judged. A table that does not exist, a row that
 * does not exist, and a rule that excludes the caller all answer `false` — the
 * caller maps every one to the records API's `Resource not found`.
 */
export const authorizeCallerWrites = (
  app: App,
  session: Readonly<UserSession>,
  tableName: string,
  requests: readonly CallerWriteRequest[]
): Effect.Effect<readonly boolean[], never, Requirements> =>
  Effect.gen(function* () {
    const refuseAll = requests.map(() => false)
    const table = app.tables?.find((t) => t.name === tableName)
    if (table === undefined) return refuseAll
    const identity = yield* loadCallerIdentity(app, session.userId, table)
    if (identity === undefined) return refuseAll
    return yield* Effect.forEach(requests, (request) =>
      request.tableName === tableName &&
      passesTableGrant(app, table, request.op, identity.effectiveRoles)
        ? passesRowAndFieldRules({ app, table, request, identity, session })
        : Effect.succeed(false)
    )
  }).pipe(
    Effect.withSpan('tables.authorize-caller-writes', {
      attributes: { 'table.name': tableName, 'write.count': requests.length },
    })
  )
