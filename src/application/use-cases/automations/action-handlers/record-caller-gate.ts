/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The caller gate every record action runs before it writes.
 *
 * A run a person started by hand writes as that person: each write it is about
 * to make is checked against the table's grants, row-level rules and field
 * write audiences for them (`authorizeCallerWrites`, one caller identity per
 * table the batch writes to), BEFORE any row is touched,
 * so a refused step writes nothing. A run nobody started passes straight
 * through and keeps writing as the system.
 *
 * The refusal is the records API's own `Resource not found` — the step fails,
 * and the run log records it, without disclosing whether the row exists.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { refuseUnreadableLinkTargets } from '@/application/use-cases/tables/link-target-check'
import { callerReadScope } from '@/application/use-cases/tables/permissions/caller-read-authority'
import {
  authorizeCallerWrites,
  type CallerWriteRequest,
} from '@/application/use-cases/tables/permissions/caller-write-authority'
import { getUserGroups } from '@/application/use-cases/tables/user-groups'
import { SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import { SIGNED_OUT_VISITOR_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { toGrantingRole } from '@/domain/models/app/auth/roles/granting-role-service'
import { logError } from '@/infrastructure/logging/logger'
import { buildGuestSession, buildSyntheticSession } from '../build-guest-session'
import { recordEventLoopRefusal } from './record-events'
import { admittedReadScope, type RunReadScope } from './run-read-admission'
import type { ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App } from '@/domain/models/app'
import type { RowGrants } from '@/domain/models/app/tables/row-read-admission-service'

/** The error a refused step reports — the records API's own answer. */
export const CALLER_REFUSAL = 'Resource not found'

/**
 * A step's answer to an account that does not exist: in a run someone started
 * by hand, the records API's `Resource not found`; otherwise the step's `named`
 * message.
 */
export const unknownAccountOutcome = (
  automation: AutomationContext | undefined,
  named: string
): ActionOutcome => ({
  status: 'failure',
  error: automation?.startedByHand === true ? CALLER_REFUSAL : named,
})

type GateRequirements = AuthRepository | DataSourceRepository | TableRepository

/**
 * The account a record write is attributed to by default: the caller of a run
 * started by hand (their `created_by` / `updated_by` / `deleted_by`, the rule that a manual run writes as the person who started it),
 * the durable system actor for any other run — and for a visitor's run, which
 * names nobody. A hand-started run that lost its caller never reaches a write —
 * {@link callerMayWrite} refuses it first.
 */
export const writerActorOf = (automation: AutomationContext): string =>
  automation.startedByHand === true && automation.userId !== undefined
    ? automation.userId
    : SYSTEM_USER_ID

/**
 * The session a hand-started run's record steps are judged as: its starter's,
 * the visitor's for a run a visitor who is not signed in started (the records
 * API's rules for such a visitor), or `undefined` when it no longer names
 * anyone — a run that then reads and writes nothing.
 */
const starterSessionOf = (automation: AutomationContext): UserSession | undefined => {
  if (automation.startedAsGuest === true) return buildGuestSession()
  return automation.userId === undefined ? undefined : buildSyntheticSession(automation.userId)
}

/**
 * Whether every write in `requests` is allowed for the run's caller. Always
 * `true` for a run nobody started by hand, and always `false` for a
 * hand-started run that no longer names its caller. A visitor's run (the guest
 * sentinel) is judged as the records API judges a visitor who is not signed in.
 */
export const callerMayWrite = (
  app: App,
  automation: AutomationContext,
  requests: readonly CallerWriteRequest[]
): Effect.Effect<boolean, never, GateRequirements> => {
  if (automation.startedByHand !== true) return Effect.succeed(true)
  const session = starterSessionOf(automation)
  if (session === undefined) return Effect.succeed(false)
  // One identity per table the batch writes to, never one per row.
  const byTable = Map.groupBy(requests, (request) => request.tableName)
  return Effect.forEach([...byTable], ([tableName, onTable]) =>
    authorizeCallerWrites(app, session, tableName, onTable)
  ).pipe(
    Effect.map((verdicts) => verdicts.every((onTable) => onTable.every(Boolean))),
    Effect.withSpan('automations.caller-may-write')
  )
}

/**
 * The failed outcome for a refused step, or `undefined` when the caller may
 * perform every write in `requests`. A `'batch'` write is refused outright to
 * a visitor's run: the records API gives a visitor who is not signed in no
 * batch write.
 */
export const callerRefusal = (
  app: App,
  automation: AutomationContext,
  requests: readonly CallerWriteRequest[],
  shape: 'single' | 'batch' = 'single'
): Effect.Effect<
  { readonly status: 'failure'; readonly error: string } | undefined,
  never,
  GateRequirements
> =>
  Effect.gen(function* () {
    const visitorBatch = shape === 'batch' && automation.startedAsGuest === true
    if (visitorBatch || !(yield* callerMayWrite(app, automation, requests))) {
      return { status: 'failure', error: CALLER_REFUSAL } as const
    }
    const linkRefusal = yield* callerLinkRefusal(app, automation, requests)
    return linkRefusal === undefined
      ? undefined
      : ({ status: 'failure', error: linkRefusal } as const)
  }).pipe(Effect.withSpan('automations.caller-refusal'))

/**
 * The error a hand-started run's CREATE reports when a relationship value names
 * a row its starter may not read — the very error a row that does not exist
 * gets — or `undefined` when every link may be written. An update is judged by
 * the update program itself, which the run hands its starter to. A run nobody
 * started links as the system and is not judged.
 */
const callerLinkRefusal = (
  app: App,
  automation: AutomationContext,
  requests: readonly CallerWriteRequest[]
): Effect.Effect<string | undefined, never, GateRequirements> =>
  Effect.gen(function* () {
    const reader = yield* runLinkReader(automation)
    if (reader === undefined) return undefined
    const byTable = requests.flatMap((request) => (request.op === 'create' ? [request] : []))
    const verdicts = yield* Effect.forEach(byTable, (request) =>
      refuseUnreadableLinkTargets({
        app,
        session: reader.session,
        tableName: request.tableName,
        writes: [{ fields: request.fields }],
        reader,
      }).pipe(
        Effect.as(undefined),
        Effect.catchTag('ForeignKeyViolationError', (refused) => Effect.succeed(refused.message)),
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[automations] link targets not judged', cause))
        ),
        // effect-swallow: a check that could not read fails closed — the step is
        // refused with the records API's answer rather than written unjudged.
        Effect.orElseSucceed(() => CALLER_REFUSAL)
      )
    )
    return verdicts.find((verdict) => verdict !== undefined)
  }).pipe(Effect.withSpan('automations.caller-link-refusal'))

/** One update request per targeted row, all carrying the same change. */
export const updatesOf = (
  tableName: string,
  recordIds: readonly string[],
  change: Readonly<Record<string, unknown>>
): readonly CallerWriteRequest[] =>
  recordIds.map((recordId) => ({ op: 'update', tableName, recordId, change }))

/** One delete request per targeted row. */
export const deletesOf = (
  tableName: string,
  recordIds: readonly string[]
): readonly CallerWriteRequest[] =>
  recordIds.map((recordId) => ({ op: 'delete', tableName, recordId }))

/**
 * The refusal a record step meets before it writes: the record-event loop guard
 * first (a step may not re-enter the write that started its run), then the
 * caller gate. `undefined` when the step may go ahead.
 */
export const writeRefusal = (input: {
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete'
  readonly requests: readonly CallerWriteRequest[]
}): Effect.Effect<ActionOutcome | undefined, never, GateRequirements> => {
  const loop = recordEventLoopRefusal(input.runContext, input.tableName, input.event)
  const refusal: Effect.Effect<ActionOutcome | undefined, never, GateRequirements> =
    loop !== undefined
      ? Effect.succeed(loop)
      : callerRefusal(input.app, input.automation, input.requests)
  return refusal.pipe(Effect.withSpan('automations.write-refusal'))
}

/**
 * How a record step reads: a run nobody started reads as the system (every row,
 * every column); a hand-started run reads as its starter, under their scope —
 * or not at all when they may not read the table or no longer have an account
 * in good standing. The scope carries the records API's row admission: the
 * records a grant names, where her own role reads no field of a record, each
 * read with the fields of her role and of the roles granted on it (`grants`).
 */
export type RunReadAccess =
  | { readonly kind: 'system' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'scoped'; readonly scope: RunReadScope; readonly grants: RowGrants }

/** The read access of the run's caller for `tableName`. */
export const runReadAccess = (
  app: App,
  automation: AutomationContext,
  tableName: string
): Effect.Effect<RunReadAccess, never, GateRequirements> => {
  if (automation.startedByHand !== true) return Effect.succeed({ kind: 'system' } as const)
  const session = starterSessionOf(automation)
  if (session === undefined) return Effect.succeed({ kind: 'refused' } as const)
  return Effect.gen(function* () {
    const scope = yield* callerReadScope(app, session, tableName)
    if (scope === undefined) return { kind: 'refused' } as const
    const reader = yield* callerLinkReader(
      automation.startedAsGuest === true ? undefined : automation.userId
    )
    const admitted = yield* admittedReadScope({ app, tableName, scope, reader })
    return admitted === undefined
      ? ({ kind: 'refused' } as const)
      : ({ kind: 'scoped', ...admitted } as const)
  }).pipe(
    Effect.withSpan('automations.run-read-access', { attributes: { 'table.name': tableName } })
  )
}

/**
 * Who a run's cleared many-to-many field is cleared for: the starter of a run
 * started by hand — so only the links they may read are removed, as a PATCH of
 * theirs would — and nobody for any other run, which clears every link.
 */
export const runLinkReader = (
  automation: AutomationContext
): Effect.Effect<LinkReader | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    const { userId } = automation
    if (automation.startedByHand !== true) return undefined
    if (automation.startedAsGuest === true) return yield* callerLinkReader(undefined)
    if (userId === undefined) return undefined
    return yield* callerLinkReader(userId)
  }).pipe(Effect.withSpan('automations.run-link-reader'))

/**
 * A caller as a {@link LinkReader}: the signed-in user `userId` with her role
 * and groups, or a visitor who is not signed in when `userId` is `undefined`.
 */
export const callerLinkReader = (
  userId: string | undefined
): Effect.Effect<LinkReader, never, AuthRepository> =>
  Effect.gen(function* () {
    if (userId === undefined) {
      return { session: buildGuestSession(), role: SIGNED_OUT_VISITOR_ROLE, groups: [] }
    }
    const auth = yield* AuthRepository
    // effect-swallow: an unreadable role reads as no role at all, which grants nothing — it can only NARROW what is read.
    const role = yield* auth.getUserRole(userId).pipe(Effect.orElseSucceed(() => undefined))
    const groups = yield* getUserGroups(userId)
    return { session: buildSyntheticSession(userId), role: toGrantingRole(role), groups }
  }).pipe(Effect.withSpan('automations.caller-link-reader'))
