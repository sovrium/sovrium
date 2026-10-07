/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who a chat read answers to, and which rows of a table it may answer with.
 *
 * A chat read — a record query, a `query_<table>` / `count_<table>` tool call,
 * the tool list advertised to the model — answers exactly what the records API
 * answers the same caller. It asks the records API's own gates rather than
 * re-deriving them:
 *
 *  - which tables, through {@link chatTableRoles}: the ONE effective-role set
 *    every table gate asks (`tableEffectiveRoles`) — the account role, a
 *    `group:<name>` entry per group and, on a table with row-level rules, every
 *    role an assignment (`user_access`) gives her;
 *  - which rows, through {@link resolveChatRowScope}: the records read gate for
 *    a named caller (`callerReadScope`), whose row-level read rule is ANDed onto
 *    the read in SQL — over the live rows only ({@link readScopeOf}): a row in
 *    the trash is never listed, counted, summed or averaged.
 *
 * A declared agent reads under its declared role and has no user identity: its
 * reach is a property of the config, so no row rule narrows it here. When it
 * answers a signed-in person, though, it reads the INTERSECTION of that reach
 * and hers ({@link ChatReader.answering}): a table both may read, rows both row
 * rules admit, columns both may read. Every gate below asks both principals, so
 * the narrowing lives here once rather than in each tool. A caller with no
 * identity under a table's row-level rule reads no row of it — a rule cannot be
 * judged for nobody.
 *
 * A visitor signed in to nothing is a person too ({@link signedOutReader}): an
 * agent open to everyone answers her within what the records API serves a
 * signed-out request — the tables whose resolved read is `'all'`, their public
 * fields, their live rows.
 */

import { Effect } from 'effect'
import { buildSyntheticSession } from '@/application/use-cases/automations/build-guest-session'
import { callerReadScope } from '@/application/use-cases/tables/permissions/caller-read-authority'
import {
  buildEffectiveRoles,
  getUserAccessRoles,
  getUserGroups,
  tableEffectiveRoles,
  type TableGateCaller,
} from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { relatedValuesRefusedTo } from '@/domain/models/app/tables/lookup-link-service'
import {
  admitsSignedOut,
  type ReadPrincipal,
} from '@/domain/models/app/tables/read-access-plan-service'
import { INTRINSIC_DELETED_AT_COLUMN } from '@/domain/models/app/tables/system-fields'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { readableColumnsForTable, type ProjectedTable } from './chat-table-projection'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/** The principal a chat turn reads as. */
export interface ChatReader extends TableGateCaller {
  /** The signed-in user the records gate judges rows for; absent for no one. */
  readonly userId?: string | undefined
  /** True for a declared agent, which reads under its declared role. */
  readonly agent?: boolean | undefined
  /**
   * The signed-in person a declared agent is answering. The agent then never
   * shows her more than she may read herself: every gate asks her too, and the
   * answer is what BOTH may read.
   */
  readonly answering?: ChatReader | undefined
}

/** A reader holding only `role` — a declared agent, or a caller with no session. */
export const roleOnlyReader = (role: string, agent: boolean): ChatReader => ({
  role,
  groups: [],
  accessRoles: [],
  agent,
})

/**
 * A caller signed in to nothing, in an app that has sign-in. The empty role is
 * the read plan's "no session" ({@link ReadPrincipal}): she reads a table only
 * where its resolved read is `'all'`, only its public fields, and no row a
 * row-level rule governs.
 */
export const signedOutReader: ChatReader = roleOnlyReader('', false)

/** True for {@link signedOutReader}: no role, no identity, not an agent. */
const isSignedOut = (reader: ChatReader): boolean =>
  reader.role === '' && reader.agent !== true && reader.userId === undefined

/**
 * A declared agent's reader: its declared role alone, narrowed to `caller`'s
 * reach when it answers a person — signed in, or signed in to nothing
 * ({@link signedOutReader}). A schedule has no caller.
 */
export const agentReader = (role: string, caller: ChatReader | undefined): ChatReader => ({
  ...roleOnlyReader(role, true),
  ...(caller !== undefined && { answering: caller }),
})

/** The effective roles the records route asks of `reader` on `tableName`. */
export const chatTableRoles = (
  app: App | undefined,
  tableName: string,
  reader: ChatReader
): readonly string[] =>
  tableEffectiveRoles(
    app?.tables?.find((table) => table.name === tableName),
    reader
  )

/**
 * The table's read grant for `reader`, over the records route's effective roles
 * for it — and for the person it answers, when it answers one. A signed-out
 * reader passes only where the records API admits a signed-out request
 * (`admitsSignedOut`): the evaluator alone answers `'authenticated'` for every
 * role, the empty one included.
 */
export const passesChatTableGate = (
  app: App | undefined,
  tables: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>,
  table: { readonly name: string; readonly permissions?: unknown },
  reader: ChatReader
): boolean =>
  hasReadPermissionForRoles(
    table as { name: string; permissions?: { read?: unknown } },
    chatTableRoles(app, table.name, reader),
    (app === undefined ? tables : { auth: app.auth, tables }) as Parameters<
      typeof hasReadPermissionForRoles
    >[2]
  ) &&
  (app === undefined ||
    !isSignedOut(reader) ||
    admitsSignedOut(app, table as Parameters<typeof admitsSignedOut>[1])) &&
  (reader.answering === undefined || passesChatTableGate(app, tables, table, reader.answering))

/**
 * The columns `reader` alone may read in `table`: those its field read rules
 * admit, less every lookup, rollup or count into a related table or field she
 * may not read and every formula over one ({@link relatedValuesRefusedTo}) —
 * the records API leaves each of them out of her read, so no tool advertises,
 * returns or filters on one.
 */
const ownReadableColumns = (
  app: App | undefined,
  table: ProjectedTable,
  reader: ChatReader
): ReadonlyArray<string> => {
  const principal: ReadPrincipal = {
    role: reader.role,
    effectiveRoles: chatTableRoles(app, table.name, reader),
    isAuthenticated: reader.role !== '',
  }
  const readable = readableColumnsForTable(app, table, principal)
  if (app === undefined) return readable
  const refused = relatedValuesRefusedTo(app, table.name, {
    role: reader.role,
    groups: reader.groups,
    signedOut: isSignedOut(reader),
  })
  return readable.filter((column) => !refused.has(column))
}

/**
 * The columns a chat read of `table` may answer with: the reader's own, and for
 * an agent answering a person, only those she may read too — with the columns
 * that narrowing withholds from the agent's own reach.
 */
export const chatReadableColumns = (
  app: App | undefined,
  table: ProjectedTable,
  reader: ChatReader
): {
  readonly readableColumns: ReadonlyArray<string>
  readonly withheldColumns?: ReadonlyArray<string>
} => {
  const own = ownReadableColumns(app, table, reader)
  if (reader.answering === undefined) return { readableColumns: own }
  const theirs = new Set(chatReadableColumns(app, table, reader.answering).readableColumns)
  return {
    readableColumns: own.filter((column) => theirs.has(column)),
    withheldColumns: own.filter((column) => !theirs.has(column)),
  }
}

/**
 * The rows of one table a chat read may answer with:
 *
 *  - `refused` — the records API would not let the caller read the table;
 *  - `all` — no row-level rule narrows the caller;
 *  - `nothing` — the rule admits no row;
 *  - `scoped` — the rule's SQL clause, to AND onto the read.
 */
export type ChatRowScope =
  | { readonly kind: 'refused' }
  | { readonly kind: 'all' }
  | { readonly kind: 'nothing' }
  | { readonly kind: 'scoped'; readonly clause: QueryFilterNode }

/**
 * The rows of `tableName` a chat read for `reader` may answer with (see above):
 * for an agent answering a person, the rows both row rules admit.
 */
export const resolveChatRowScope = async (
  services: DomainContext,
  app: App | undefined,
  tableName: string,
  reader: ChatReader
): Promise<ChatRowScope> => {
  const own = await ownRowScope(services, app, tableName, reader)
  if (reader.answering === undefined || own.kind === 'refused' || own.kind === 'nothing') {
    return own
  }
  return intersectRowScopes(
    own,
    await resolveChatRowScope(services, app, tableName, reader.answering)
  )
}

/** The rows two readers may BOTH read: a refusal or an empty side wins, clauses AND. */
const intersectRowScopes = (left: ChatRowScope, right: ChatRowScope): ChatRowScope => {
  if (left.kind === 'refused' || right.kind === 'refused') return { kind: 'refused' }
  if (left.kind === 'nothing' || right.kind === 'nothing') return { kind: 'nothing' }
  if (left.kind === 'all') return right
  if (right.kind === 'all') return left
  return { kind: 'scoped', clause: { and: [left.clause, right.clause] } }
}

/** The rows of `tableName` `reader` alone may read. */
const ownRowScope = async (
  services: DomainContext,
  app: App | undefined,
  tableName: string,
  reader: ChatReader
): Promise<ChatRowScope> => {
  const table = app?.tables?.find((candidate) => candidate.name === tableName)
  if (app === undefined || table === undefined) return { kind: 'all' }
  if (reader.userId === undefined) return anonymousRowScope(table, reader)
  const scope = await Effect.runPromise(
    callerReadScope(app, buildSyntheticSession(reader.userId), tableName).pipe(
      Effect.provide(services),
      // A scope that cannot be read refuses the table, as the records API does
      // when it cannot read the caller's access: logged, never guessed (E6).
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          logError('[ai-chat] reading the caller read scope failed; refusing the table', cause, {
            table: tableName,
          })
          return undefined
        })
      )
    )
  )
  if (scope === undefined) return { kind: 'refused' }
  if (scope.clause === undefined) return { kind: 'all' }
  if (scope.clause === 'nothing') return { kind: 'nothing' }
  return { kind: 'scoped', clause: scope.clause }
}

/** A reader with no user: a declared agent reads every row, nobody else a governed one. */
const anonymousRowScope = (
  table: { readonly rowLevelPermissions?: { readonly read?: { readonly when?: unknown } } },
  reader: ChatReader
): ChatRowScope => {
  if (reader.agent === true) return { kind: 'all' }
  return table.rowLevelPermissions?.read?.when === undefined ? { kind: 'all' } : { kind: 'nothing' }
}

/**
 * A live row: not in the trash. The records API reads no row whose
 * `deleted_at` is set (every table the engine creates carries the column), so
 * neither does a chat read.
 */
const LIVE_ROW: QueryFilterNode = {
  field: INTRINSIC_DELETED_AT_COLUMN,
  operator: 'isNull',
  value: undefined,
}

/**
 * The `readScope` a dynamic read carries: the live rows, narrowed by the
 * row-level rule for a `scoped` scope. A `nothing` or `refused` scope reads no
 * row, and its callers answer without a query.
 */
export const readScopeOf = (scope: ChatRowScope): { readonly readScope?: QueryFilterNode } => {
  if (scope.kind === 'all') return { readScope: LIVE_ROW }
  if (scope.kind === 'scoped') return { readScope: { and: [LIVE_ROW, scope.clause] } }
  return {}
}

/**
 * Resolve the current user's role AND group memberships from the authenticated
 * session, returning both the bare role and the effective-role list that table
 * RBAC is evaluated against.
 *
 * The generic `/api/ai/chat` route is `requireAuth`-gated, so a session is
 * normally present. The `'member'` fallback keeps the handler total in the
 * defensive case where the session is somehow absent — the context builder
 * then describes only tables the default role can read.
 *
 * Groups matter here because a table permission may name `group:<name>`, which
 * a bare role string can never match. Unlike the HTTP table routes there is no
 * `enrichUserRole` middleware on this path, so the lookup is made explicitly —
 * `getUserGroups` is documented as a plain async lookup with no request
 * context for exactly this caller shape, and never throws.
 *
 * The assignment roles are resolved too, and count on a table with row-level
 * rules exactly as on the records route (`chatTableRoles`); the user's id goes
 * with them, so the records read gate can judge her rows.
 */
export const resolveUserPrincipal = async (
  c: Context
): Promise<{
  readonly userRole: string
  readonly effectiveRoles: readonly string[]
  readonly reader: ChatReader
}> => {
  const session = getSessionContext(c)
  if (session === undefined) {
    return {
      userRole: 'member',
      effectiveRoles: ['member'],
      reader: roleOnlyReader('member', false),
    }
  }
  // The records route's own lookups: the assignment roles fail closed (an
  // unreadable overlay grants nothing) and only count on a table with
  // row-level rules (`chatTableRoles`).
  const [userRole, userGroups, accessRoles] = await runDomainPromise(
    c,
    Effect.all([
      getUserRole(session.userId),
      getUserGroups(session.userId),
      getUserAccessRoles(session.userId),
    ])
  )
  return {
    userRole,
    effectiveRoles: buildEffectiveRoles(userRole, userGroups),
    reader: { role: userRole, groups: userGroups, accessRoles, userId: session.userId },
  }
}

/**
 * The person a declared agent answers: the signed-in caller, or — in an app
 * with sign-in — {@link signedOutReader} for a visitor signed in to nothing. An
 * app without sign-in has no such visitor to tell apart: its agents read with
 * their declared reach.
 */
export const agentCaller = async (c: Context, app: App): Promise<ChatReader | undefined> => {
  if (getSessionContext(c) !== undefined) {
    return (await resolveUserPrincipal(c)).reader
  }
  return app.auth === undefined ? undefined : signedOutReader
}
