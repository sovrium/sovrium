/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { logError } from '@/infrastructure/logging/logger'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'

/**
 * Names of the auth lifecycle events that an `auth` trigger can subscribe
 * to. Mirrors the union in `src/domain/models/app/automations/trigger/auth.ts`
 * verbatim — kept here as a value-level allow-list so we can index into it
 * without reaching into the trigger-schema module.
 */
export type AuthTriggerEvent = 'signUp' | 'signIn' | 'signOut' | 'passwordReset' | 'emailVerified'

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
 * `processEnv` is captured at the hook boundary and threaded through to
 * `executeAutomationRun` so action handlers can resolve `$env.VAR_NAME`
 * references and secrets get redacted from run-history. Mirrors the
 * pattern used by `triggerRecordEventAutomations`.
 *
 * `userId` is surfaced to the engine for run-history attribution (the
 * "who triggered this" column). For auth events that's always the same
 * user as `user.id`.
 */
export interface TriggerAuthEventInput {
  readonly app: App
  readonly event: AuthTriggerEvent
  readonly user: Readonly<Record<string, unknown>>
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly userId?: string
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
): readonly NonNullable<App['automations']>[number][] =>
  (app.automations ?? []).filter((automation) => {
    if (!isAutomationOperationallyEnabled(automation, pausedNames)) return false
    const { trigger } = automation
    if (trigger.type !== 'auth') return false
    if (!trigger.events.includes(event)) return false
    return true
  })

/**
 * Fire all auth-triggered automations matching the given lifecycle event.
 *
 * The Better Auth `databaseHooks` block in
 * `src/infrastructure/auth/better-auth/auth.ts:buildDatabaseHooks` calls
 * this from a plain-async context via
 * `Effect.runPromise(provideAutomationRuntime(triggerAuthEventAutomations({...})))`
 * — the Effect requirements are resolved at the infrastructure boundary so
 * the use case stays free of the dependency graph itself, matching the
 * pattern used by `triggerRecordEventAutomations`.
 *
 * Errors are absorbed at the boundary: a sign-up endpoint must not return
 * 500 because an automation crashed. The run row records the failure for
 * operator diagnosis.
 */
export const triggerAuthEventAutomations = (
  input: TriggerAuthEventInput
): Effect.Effect<void, never, ExecuteAutomationRunRequirements | AutomationPauseRepository> =>
  Effect.gen(function* () {
    const { app, event, user, processEnv, userId } = input
    // Entry point: one read of the operational pauses per auth event.
    const pausedNames = yield* loadPausedAutomationNames
    const matching = findMatchingAuthAutomations(app, event, pausedNames)
    if (matching.length === 0) return

    yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchAutomationOnce({
          automation,
          app,
          processEnv,
          triggerData: { user, event } as TriggerData,
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
