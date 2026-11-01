/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The read grant a table subscription is opened under, and its re-check on
 * every change: which fields and which rows one subscriber may receive.
 */

import { Effect } from 'effect'
import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type ReadAccessPlan,
} from '@/domain/models/app/tables/read-access-plan-service'
import { grantFingerprint } from '@/domain/models/app/tables/realtime-grant-fingerprint-service'
import {
  withinAdmittedRows,
  type RowReadRule,
} from '@/domain/models/app/tables/realtime-row-scope-service'
import { rowPassesRule } from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { guardForTable, type GuardCaller, type RowLevelGuardContext } from './row-level-guard'
import { rowStreamColumnsOf, type RowStreamColumns } from './subscription-payload'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { RowReadAdmission } from '@/domain/models/app/tables/row-read-admission-service'
import type { Table } from '@/domain/models/app/tables/table'
import type { RecheckSweep } from '@/infrastructure/realtime/connection-counter'
import type { Context } from 'hono'

// ---------------------------------------------------------------------------
// Field-permission resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the composed read plan for one subscription handshake, through the
 * canonical {@link buildReadAccessPlan} under {@link CANONICAL_READ_POLICY} —
 * the records list's own.
 *
 * The roles are the records API's: on a table with a row-level rule they are
 * the guard's (account role, groups AND `user_access` roles), so a caller the
 * records API admits through that overlay is admitted to the stream of the same
 * rows. They decide admission only — a field is matched against her own role
 * and groups, never a role she holds through a grant elsewhere — and a change
 * carries, row by row, the columns a list of that row returns her
 * (`rowStreamColumnsOf`). The rows are scoped per event by {@link readRuleOf}.
 */
const resolveReadPlan = (
  table: Table,
  caller: { readonly userRole: string; readonly effectiveRoles: readonly string[] },
  app: App,
  guard: RowLevelGuardContext | undefined
): ReadAccessPlan =>
  buildReadAccessPlan({
    app,
    table,
    principal: {
      role: caller.userRole,
      effectiveRoles: caller.effectiveRoles,
      isAuthenticated: true,
    },
    policy: CANONICAL_READ_POLICY,
    rowContext: guard?.current,
  })

/**
 * The subscriber's row-level read rule, as a pure in-memory predicate over a
 * changed row, held to the rows a list admits them — or `undefined` when no
 * rule governs them and they read every row. Resolved once per connection, so
 * each fanned-out change costs one predicate evaluation and no database read.
 */
export const readRuleOf = (
  table: Table,
  { guard, rows }: Pick<SubscriptionGrant, 'guard' | 'rows'>
): RowReadRule | undefined => {
  const rlp = table.rowLevelPermissions
  const ruled =
    rlp?.read?.when !== undefined && guard !== undefined && !guard.current.isUnrestricted
  // Judged as the records API reads the row: a SQLite `1`/`0` boolean is
  // `true`/`false` before the rule sees it, whichever row the event carries.
  const rule: RowReadRule | undefined = ruled
    ? (row) => rowPassesRule(rlp, 'read', readStoredValues(table, row), guard.current)
    : undefined
  return withinAdmittedRows(rule, rows)
}

// ---------------------------------------------------------------------------
// Grant resolution — one path, shared by the handshake and the re-check
// ---------------------------------------------------------------------------

/** What one resolution of a subscriber's grant on a table decided. */
export interface SubscriptionGrant {
  readonly guard: RowLevelGuardContext | undefined
  readonly plan: ReadAccessPlan
  /** The columns the stream may carry to this subscriber, row by row. */
  readonly columns: RowStreamColumns
  /** The rows a list of the table returns the subscriber (`readerRowsOf`). */
  readonly rows: RowReadAdmission
  /** The grant reduced to one comparable string — see `grantFingerprint`. */
  readonly fingerprint: string
}

/**
 * Resolve a subscriber's grant on one table: the records API's roles and row
 * context (on a row-rule table the guard adds the caller's `user_access` roles
 * and loads what the rule reads), then the read plan. The handshake and the
 * periodic re-check both resolve through here, so a connection is never judged
 * by a second path that could drift from the first.
 */
const resolveSubscriptionGrant = async (
  c: Context,
  session: Readonly<UserSession>,
  caller: GuardCaller,
  { table, app }: { readonly table: Table; readonly app: App }
): Promise<SubscriptionGrant> => {
  const guard = await runDomainPromise(c, guardForTable(session, caller, table, app))
  const effectiveRoles =
    guard?.effectiveRoles ?? buildEffectiveRoles(caller.userRole, caller.userGroups)
  const admitted = resolveReadPlan(table, { userRole: caller.userRole, effectiveRoles }, app, guard)
  const reader = { role: caller.userRole, groups: caller.userGroups }
  const { admission: rows, grants } = await runDomainPromise(
    c,
    readerRowsOf(app, table.name, { ...reader, session })
  )
  const columns = rowStreamColumnsOf(app, table, reader, grants)
  // The handshake reports the columns her own role reads over the stream.
  const plan = { ...admitted, columnWhitelist: columns.own }
  const fingerprint = grantFingerprint({
    allowed: plan.allowed,
    columns: columns.own,
    rows,
    grants,
    rowContext: guard?.current,
  })
  return { guard, plan, columns, rows, fingerprint }
}

/**
 * The grant at the handshake, or `undefined` when it could not be read.
 *
 * A fault answers exactly as a denial does, and a denial answers exactly as a
 * missing table: a `500` that only an existing table can produce would tell the
 * caller the table exists, which the `404` is there to hide.
 */
export const resolveHandshakeGrant = (
  c: Context,
  session: Readonly<UserSession>,
  caller: GuardCaller,
  { table, app }: { readonly table: Table; readonly app: App }
): Promise<SubscriptionGrant | undefined> =>
  resolveSubscriptionGrant(c, session, caller, { table, app }).catch(
    (cause: unknown): SubscriptionGrant | undefined => {
      // The refusal IS the answer — a grant that cannot be read is refused
      // exactly as a missing table is (see above), and the cause is logged on
      // the way past (E6).
      logError('[realtime] resolving a subscription grant failed; refusing it', cause, {
        table: table.name,
      })
      return undefined
    }
  )

/**
 * The caller's account role and groups, as the table middleware resolves them
 * for a request — on the services of the request that opened the connection.
 */
const resolveCaller = (c: Context, userId: string): Promise<GuardCaller> =>
  runDomainPromise(
    c,
    Effect.all({ userRole: getUserRole(userId), userGroups: getUserGroups(userId) })
  )

/**
 * The periodic re-check of one connection's grant: resolve it again from the
 * account up, and answer whether it is still the one the connection opened
 * with. The sweep memoises the caller per user and the grant per user and
 * table, so a user holding several connections to one table costs one
 * resolution per sweep, not one per connection.
 */
export const recheckGrant =
  (input: {
    readonly c: Context
    readonly session: Readonly<UserSession>
    readonly table: Table
    readonly app: App
    readonly fingerprint: string
  }) =>
  async (sweep: RecheckSweep): Promise<boolean> => {
    const { c, session, table, app, fingerprint } = input
    const caller = await sweep.memo(`caller:${session.userId}`, () =>
      resolveCaller(c, session.userId)
    )
    const grant = await sweep.memo(`grant:${session.userId}:${table.name}`, () =>
      resolveSubscriptionGrant(c, session, caller, { table, app })
    )
    return grant.fingerprint === fingerprint
  }
