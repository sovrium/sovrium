/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { App } from '@/domain/models/app'

export type AuthTriggerEvent = 'signUp' | 'signIn' | 'signOut' | 'passwordReset' | 'emailVerified'

export interface TriggerAuthEventInput {
  readonly app: App
  readonly event: AuthTriggerEvent
  readonly user: Readonly<Record<string, unknown>>
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly userId?: string
}

const findMatchingAuthAutomations = (
  app: App,
  event: AuthTriggerEvent
): readonly NonNullable<App['automations']>[number][] =>
  (app.automations ?? []).filter((automation) => {
    if (automation.enabled === false) return false
    const { trigger } = automation
    if (trigger.type !== 'auth') return false
    if (!trigger.events.includes(event)) return false
    return true
  })

export const triggerAuthEventAutomations = (
  input: TriggerAuthEventInput
): Effect.Effect<void, never, ExecuteAutomationRunRequirements> =>
  Effect.gen(function* () {
    const { app, event, user, processEnv, userId } = input
    const matching = findMatchingAuthAutomations(app, event)
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
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[automation:auth-event] dispatch failure', cause)
      })
    )
  )
