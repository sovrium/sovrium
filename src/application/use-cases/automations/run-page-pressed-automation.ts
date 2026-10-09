/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { triggerOfTypeOrFirst } from '@/domain/models/app/automations/trigger-entries-service'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements, RunAutomationResult } from './run-automation'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'

type Automation = NonNullable<App['automations']>[number]

/** The one refusal: answered exactly as a name nobody declared. */
export interface PagePressedAutomationNotFound {
  readonly _tag: 'AutomationNotFound'
  readonly name: string
}

/** What a page press hands the dispatch: {@link dispatchAutomationOnce}'s input. */
export type PagePressDispatchInput = Parameters<typeof dispatchAutomationOnce>[0]

export interface RunPagePressedAutomationOptions {
  /** The automation the page gate admitted (manual, page-bound, role checked). */
  readonly automation: Automation
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  /** The presser's id, from the session the page gate judged; `undefined` for a visitor. */
  readonly userId: string | undefined
}

/**
 * Run the automation a page button, an alert-dialog confirm or a data form
 * pressed, once the page gate admitted it.
 *
 * Two things the other roads already did, now on this one too:
 *
 *   1. the operational state is read here, once: an automation an operator
 *      paused, or one the config switches off (`enabled: false`), is refused
 *      as a name nobody declared, and nothing runs;
 *   2. a signed-in presser is recorded as the run's hand-starter, as on the
 *      direct trigger route, so she reads her run and acts on it under the act
 *      gate. A press with no session records no starter.
 *
 * Answers `undefined` when the automation could not be seeded (see
 * {@link dispatchAutomationOnce}). Built over its dispatch so a unit test can
 * hand it a recording one; {@link runPagePressedAutomation} is the real road.
 */
export const runPagePressedAutomationWith =
  <R>(
    dispatch: (
      input: PagePressDispatchInput
    ) => Effect.Effect<RunAutomationResult | undefined, never, R>
  ) =>
  ({
    automation,
    app,
    processEnv,
    triggerData,
    userId,
  }: RunPagePressedAutomationOptions): Effect.Effect<
    RunAutomationResult | undefined,
    PagePressedAutomationNotFound,
    R | AutomationPauseRepository
  > =>
    Effect.gen(function* () {
      const pausedNames = yield* loadPausedAutomationNames
      if (!isAutomationOperationallyEnabled(automation, pausedNames)) {
        return yield* Effect.fail({ _tag: 'AutomationNotFound' as const, name: automation.name })
      }
      return yield* dispatch({
        automation,
        // A press starts the manual entry; the gate admitted only an automation that has one.
        trigger: triggerOfTypeOrFirst(automation, 'manual'),
        app,
        processEnv,
        triggerData,
        userId,
        ...(userId === undefined ? {} : { startedByHand: true }),
      })
    })

/** A page press, dispatched through the shared engine loop. */
export const runPagePressedAutomation = (
  options: RunPagePressedAutomationOptions
): Effect.Effect<
  RunAutomationResult | undefined,
  PagePressedAutomationNotFound,
  ExecuteAutomationRunRequirements | AutomationPauseRepository
> =>
  runPagePressedAutomationWith(dispatchAutomationOnce)(options).pipe(
    Effect.withSpan('automations.run-page-pressed-automation')
  )
