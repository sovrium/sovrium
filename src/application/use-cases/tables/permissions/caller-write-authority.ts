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
 * stands and as it would be written, and the field write audiences. The grant
 * and the row rules are the records API's own verb verdicts
 * (`authorize-record-verbs`); the field audiences are the domain's
 * (`field-write-permission-service`). This program gathers what they read — the
 * caller's role, groups, `user_access` roles and assignments — through the
 * repository ports, and asks them.
 *
 * It DECLARES its requirements (standing rule E1): the run that calls it
 * already holds the automation runtime's services.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import {
  getUserAccessRoles,
  getUserGroups,
  tableEffectiveRoles,
} from '@/application/use-cases/tables/user-groups'
import { GUEST_USER_ID, isGuestSession } from '@/domain/models/app/auth/guest-session'
import { SIGNED_OUT_VISITOR_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { toGrantingRole } from '@/domain/models/app/auth/roles/granting-role-service'
import { createOpensToEveryone } from '@/domain/models/app/auth/visitor-create-grant-service'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import { createAllowed } from '@/domain/models/app/tables/row-level-write-decision-service'
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import { logError } from '@/infrastructure/logging/logger'
import { rowsReaderMayNotList } from '../row-read-admission'
import { authorizeCreate, authorizeDelete, authorizeUpdate } from './authorize-record-verbs'
import { loadCurrentUserContext, rowRuleScopeOf } from './row-level-enforcement'
import type { AuthorizationCaller } from './authorization-caller'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
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
    // effect-swallow: fail-closed — a role that cannot be read refuses the write (no caller); the cause is logged on the way.
    const roleLookup = yield* Effect.result(
      auth.getUserRole(userId).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[tables] the caller role could not be read; refusing the write', cause, {
              'sovrium.user.id': userId,
            })
          )
        )
      )
    )
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

/**
 * A visitor who is not signed in, as the records API judges her: the visitor
 * placeholder role, no group, no assignment, and the row-level context of
 * someone the rules cannot name.
 */
const loadVisitorIdentity = (
  app: App,
  table: Table
): Effect.Effect<CallerIdentity, never, Requirements> =>
  Effect.gen(function* () {
    const role = SIGNED_OUT_VISITOR_ROLE
    const ctx = yield* loadCurrentUserContext(
      { userId: GUEST_USER_ID, role, isUnrestricted: false },
      table.rowLevelPermissions,
      rowRuleScopeOf(table, app.tables)
    )
    return { role, groups: [], accessRoles: [], effectiveRoles: [role], ctx }
  }).pipe(Effect.withSpan('tables.load-visitor-identity'))

/**
 * Who a session is, for the read and write decisions: a visitor who is not
 * signed in for the guest sentinel, else the named caller
 * ({@link loadCallerIdentity}).
 */
export const loadSessionIdentity = (
  app: App,
  userId: string,
  table: Table
): Effect.Effect<CallerIdentity | undefined, never, Requirements> =>
  (isGuestSession(userId)
    ? loadVisitorIdentity(app, table)
    : loadCallerIdentity(app, userId, table)
  ).pipe(Effect.withSpan('tables.load-session-identity'))

/**
 * A visitor who is not signed in creates only in a table whose create is open
 * to everyone, inside its `create.when` and the field write audiences, and
 * never updates or deletes — the records API's rule. She has no effective
 * roles a verdict could judge, so her answer is the table's own.
 */
const visitorMayWrite = (
  app: App,
  table: Table,
  request: CallerWriteRequest,
  identity: CallerIdentity
): boolean =>
  request.op === 'create' &&
  createOpensToEveryone(table, app.tables ?? []) &&
  createAllowed(table, request.fields, identity.ctx) &&
  forbiddenWriteFields(app, table.name, identity, request.fields).length === 0

/** The fields of the request the caller may not write: a create's fields, an update's change. */
const forbiddenFieldsOf = (
  app: App,
  table: Table,
  request: CallerWriteRequest,
  identity: CallerIdentity
): readonly string[] => {
  if (request.op === 'delete') return []
  const proposed = request.op === 'create' ? request.fields : request.change
  return forbiddenWriteFields(app, table.name, identity, proposed)
}

/**
 * Whether a named caller may perform the request: the verb's verdict — the
 * table's grant for it (behind the grant to read the table, for an update or a
 * delete), the row-level rules on the stored row and on the row as written —
 * then the field write audiences on what she proposes.
 */
const namedCallerMayWrite = (input: {
  readonly app: App
  readonly table: Table
  readonly request: CallerWriteRequest
  readonly identity: CallerIdentity
  readonly session: Readonly<UserSession>
}): Effect.Effect<boolean, never, TableRepository> => {
  const { app, table, request, identity, session } = input
  const caller: AuthorizationCaller = {
    current: identity.ctx,
    effectiveRoles: identity.effectiveRoles,
    allTables: app,
    signedOut: false,
  }
  const target = { kind: 'record', session, tableName: table.name } as const
  const verdict =
    request.op === 'create'
      ? authorizeCreate(table, caller, [request.fields])
      : request.op === 'update'
        ? authorizeUpdate(table, caller, {
            ...target,
            recordId: request.recordId,
            change: request.change,
          })
        : authorizeDelete(table, caller, { ...target, recordId: request.recordId })
  return Effect.map(
    verdict,
    (judged) =>
      judged._tag === 'Allowed' && forbiddenFieldsOf(app, table, request, identity).length === 0
  )
}

/**
 * Whether the caller the session names may perform each of `requests` — all on
 * ONE table — answered in order, with the caller's identity gathered once for
 * the whole set: a write that reaches many rows (an assistant's bulk update or
 * delete, a hand-started automation's batch) judges each row exactly as a
 * single write of it would be judged. A table that does not exist, a row that
 * does not exist, and a rule that excludes the caller all answer `false` — the
 * caller maps every one to the records API's `Resource not found` — and so does
 * an update or a delete of a row her list of the table does not admit
 * (`readerRowsOf`), which to every write is a row that does not exist.
 */
export const authorizeCallerWrites = (
  app: App,
  session: Readonly<UserSession>,
  tableName: string,
  requests: readonly CallerWriteRequest[]
): Effect.Effect<readonly boolean[], never, Requirements> =>
  Effect.gen(function* () {
    const refuseAll = requests.map(() => false)
    const table = findTableByName(app.tables, tableName)
    if (table === undefined) return refuseAll
    const identity = yield* loadSessionIdentity(app, session.userId, table)
    if (identity === undefined) return refuseAll
    const reader = { session, role: identity.role, groups: identity.groups }
    const stored = requests.flatMap((request) =>
      request.op === 'create' ? [] : [request.recordId]
    )
    const unlisted = new Set(yield* rowsReaderMayNotList(app, tableName, reader, stored))
    const listed = (request: CallerWriteRequest): boolean =>
      request.op === 'create' || !unlisted.has(request.recordId)
    return yield* Effect.forEach(requests, (request) => {
      if (request.tableName !== tableName || !listed(request)) return Effect.succeed(false)
      return identity.role === SIGNED_OUT_VISITOR_ROLE
        ? Effect.succeed(visitorMayWrite(app, table, request, identity))
        : namedCallerMayWrite({ app, table, request, identity, session })
    })
  }).pipe(
    Effect.withSpan('tables.authorize-caller-writes', {
      attributes: { 'table.name': tableName, 'write.count': requests.length },
    })
  )
