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
import { judgePress, type PressRefusal } from './judge-press'
import { loadPausedAutomationNames } from './paused-automation-names'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements, RunAutomationResult } from './run-automation'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { PressReference } from '@/domain/models/api/automations/automations'
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
  /**
   * The record a row action or a record-bound button was pressed on: the
   * control's conditions are judged on it before anything runs. A press that
   * names no record is not judged by them.
   */
  readonly press?: PressReference
}

/**
 * Who a press is started by: the signed-in presser, or a visitor who is not
 * signed in. An app without sign-in has no visitor to tell apart — its records
 * API serves every caller alike — so a press there runs as the system.
 */
const pressStarterOf = (
  app: App,
  userId: string | undefined
): { readonly startedByHand?: true; readonly startedAsGuest?: true } => {
  if (userId !== undefined) return { startedByHand: true }
  return app.auth === undefined ? {} : { startedByHand: true, startedAsGuest: true }
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
 *   2. a press is always started by hand. A signed-in presser is recorded as
 *      the run's hand-starter, as on the direct trigger route, so she reads her
 *      run and acts on it under the act gate. A press with no session runs as a
 *      guest: its record steps answer to the records API's rules for a visitor
 *      who is not signed in, and it records no starter (in an app without
 *      sign-in, the system's, as every caller there is alike).
 *
 * A press that names its record is judged first (`judge`, {@link judgePress}
 * on the real road): its control's conditions on that record decide whether it
 * runs.
 *
 * Answers `undefined` when the automation could not be seeded (see
 * {@link dispatchAutomationOnce}). Built over its dispatch so a unit test can
 * hand it a recording one; {@link runPagePressedAutomation} is the real road.
 */
export const runPagePressedAutomationWith =
  <R, J = never>(
    dispatch: (
      input: PagePressDispatchInput
    ) => Effect.Effect<RunAutomationResult | undefined, never, R>,
    judge: (input: Parameters<typeof judgePress>[0]) => Effect.Effect<void, PressRefusal, J> = () =>
      Effect.void
  ) =>
  ({
    automation,
    app,
    processEnv,
    triggerData,
    userId,
    press,
  }: RunPagePressedAutomationOptions): Effect.Effect<
    RunAutomationResult | undefined,
    PagePressedAutomationNotFound | PressRefusal,
    R | J | AutomationPauseRepository
  > =>
    Effect.gen(function* () {
      const pausedNames = yield* loadPausedAutomationNames
      if (!isAutomationOperationallyEnabled(automation, pausedNames)) {
        return yield* Effect.fail({ _tag: 'AutomationNotFound' as const, name: automation.name })
      }
      if (press !== undefined) yield* judge({ app, name: automation.name, press, userId })
      return yield* dispatch({
        automation,
        // A press starts the manual entry; the gate admitted only an automation that has one.
        trigger: triggerOfTypeOrFirst(automation, 'manual'),
        app,
        processEnv,
        triggerData,
        userId,
        ...pressStarterOf(app, userId),
      })
    })

/** A page press, dispatched through the shared engine loop. */
export const runPagePressedAutomation = (
  options: RunPagePressedAutomationOptions
): Effect.Effect<
  RunAutomationResult | undefined,
  PagePressedAutomationNotFound | PressRefusal,
  ExecuteAutomationRunRequirements | AutomationPauseRepository
> =>
  runPagePressedAutomationWith(
    dispatchAutomationOnce,
    judgePress
  )(options).pipe(Effect.withSpan('automations.run-page-pressed-automation'))
