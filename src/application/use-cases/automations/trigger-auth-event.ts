/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { firstMatchingTrigger } from '@/domain/models/app/automations/trigger-entries-service'
import { logError } from '@/infrastructure/logging/logger'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { AuthTriggerEvent } from '@/application/ports/contracts/auth-hook-policies'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/**
 * Names of the auth lifecycle events that an `auth` trigger can subscribe
 * to. Mirrors the union in `src/domain/models/app/automations/trigger/auth.ts`
 * verbatim. Declared on the auth-hook contract, which the Better Auth hooks
 * dispatch through, and re-exported here for this use-case's own callers.
 */
export type { AuthTriggerEvent }

/**
 * Inputs to the auth-event trigger.
 *
 * `user` is the freshly created / authenticated / reset / verified user
 * row, surfaced to actions via `{{trigger.data.user.X}}`. Specs reference
 * `user.id` and `user.email` most commonly — both are guaranteed present
 * in Better Auth's `User` shape so the dispatch never templates the empty
 * string for those leaves. The whole record is passed through unchanged so
 * downstream actions can read custom fields too.
 *
 * `userId` is surfaced to the engine for run-history attribution (the
 * "who triggered this" column). For auth events that's always the same
 * user as `user.id`.
 */
export interface TriggerAuthEventInput {
  readonly app: App
  readonly event: AuthTriggerEvent
  readonly user: Readonly<Record<string, unknown>>
  readonly userId?: string
  /**
   * What the event says besides the account, beside `user` and `event` in
   * `{{trigger.data.*}}` — `invitationAccepted`'s `role`, `invitedBy` and
   * `invitationCreatedAt`. It never overrides `user` or `event`.
   */
  readonly data?: Readonly<Record<string, unknown>>
}

/**
 * Filter app.automations down to auth-triggered automations whose trigger
 * config subscribes to the given lifecycle event. Disabled automations are
 * excluded so an admin can pause a misbehaving workflow without uninstall.
 *
 * Mirrors `findMatchingRecordAutomations` in `trigger-record-event.ts`. The
 * predicate is intentionally narrow — there is no `watchFields` /
 * `condition` analogue on the auth-trigger schema yet, so this filter only
 * needs the `(type, event)` tuple match.
 */
const findMatchingAuthAutomations = (
  app: App,
  event: AuthTriggerEvent,
  pausedNames: ReadonlySet<string>
): ReadonlyArray<{
  readonly automation: NonNullable<App['automations']>[number]
  readonly trigger: Trigger
}> =>
  (app.automations ?? []).flatMap((automation) => {
    if (!isAutomationOperationallyEnabled(automation, pausedNames)) return []
    // One run per event: the first auth entry listening to it starts it.
    const trigger = firstMatchingTrigger(automation, 'auth', (entry) =>
      entry.events.includes(event)
    )
    return trigger === undefined ? [] : [{ automation, trigger }]
  })

/**
 * Fire all auth-triggered automations matching the given lifecycle event.
 *
 * The Better Auth hooks reach this through the `dispatchAuthEvent` policy the
 * server binds into each auth instance
 * (`src/infrastructure/server/auth-hook-policies.ts`), which runs it with
 * `runOnDomain(domainContext, …)` — the Effect requirements are resolved by the
 * server's domain runtime, so the use case stays free of the dependency graph
 * itself, matching the pattern used by `triggerRecordEventAutomations`.
 *
 * Errors are absorbed at the boundary: a sign-up endpoint must not return
 * 500 because an automation crashed. The run row records the failure for
 * operator diagnosis.
 */
export const triggerAuthEventAutomations = (
  input: TriggerAuthEventInput
): Effect.Effect<void, never, ExecuteAutomationRunRequirements | AutomationPauseRepository> =>
  Effect.gen(function* () {
    const { app, event, user, userId } = input
    // Entry point: one read of the operational pauses per auth event.
    const pausedNames = yield* loadPausedAutomationNames
    const matching = findMatchingAuthAutomations(app, event, pausedNames)
    if (matching.length === 0) return

    yield* Effect.forEach(
      matching,
      ({ automation, trigger }) =>
        dispatchAutomationOnce({
          automation,
          trigger,
          app,
          triggerData: { ...input.data, user, event } as TriggerData,
          userId,
        }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        logError('[automation:auth-event] dispatch failure', cause)
      })
    ),
    Effect.withSpan('automations.trigger-auth-event-automations')
  )
