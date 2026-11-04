/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { firstMatchingTrigger } from '@/domain/models/app/automations/trigger-entries-service'
import { buildSystemSession } from './build-guest-session'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { App } from '@/domain/models/app'
import type { SignatureTriggerPayload } from '@/domain/models/app/signatures/signature-request-service'

/** One move of a signing request, as its triggers hear it. */
export interface TriggerSignatureEventInput {
  readonly app: App
  /** The flow whose request moved. */
  readonly flow: { readonly name: string; readonly table: string }
  readonly recordId: string
  readonly signature: SignatureTriggerPayload
  /** How many automation writes deep the move is: 0 for a signer, N+1 from a step. */
  readonly depth?: number
}

/** The automations listening to `event` of `flow`, each with the entry that matched. */
const listeningAutomations = (
  app: App,
  input: TriggerSignatureEventInput,
  pausedNames: ReadonlySet<string>
) =>
  (app.automations ?? []).flatMap((automation) => {
    if (!isAutomationOperationallyEnabled(automation, pausedNames)) return []
    const trigger = firstMatchingTrigger(
      automation,
      'signature',
      (entry) => entry.flow === input.flow.name && entry.event === input.signature.event
    )
    return trigger === undefined ? [] : [{ automation, trigger }]
  })

/**
 * Start every automation listening to one move of a signing request, one after
 * the other. Each run receives `$trigger.signature` (the request id, the event,
 * the status after it, the signer and the reason when there is one) and
 * `$trigger.record`, the record as it stands now. Neither carries a contact
 * detail or a link: a run is read by people the signer never chose.
 *
 * A failure is absorbed: the move it reports has already been committed.
 */
export const triggerSignatureEventAutomations = (
  input: TriggerSignatureEventInput
): Effect.Effect<
  void,
  never,
  ExecuteAutomationRunRequirements | AutomationPauseRepository | TableRepository
> =>
  Effect.gen(function* () {
    const pausedNames = yield* loadPausedAutomationNames
    const matching = listeningAutomations(input.app, input, pausedNames)
    if (matching.length === 0) return
    const tables = yield* TableRepository
    const record = yield* tables
      .getRecord(buildSystemSession(), input.flow.table, input.recordId)
      .pipe(
        Effect.tapCause((cause) =>
          Effect.logWarning('[automation:signature] the record could not be read', cause)
        ),
        // effect-swallow: the runs still start, with `$trigger.signature` and no `$trigger.record`.
        Effect.orElseSucceed(() => null)
      )
    const triggerData = {
      signature: input.signature,
      ...(record === null ? {} : { record }),
    } as TriggerData
    yield* Effect.forEach(
      matching,
      ({ automation, trigger }) =>
        dispatchAutomationOnce({
          ...{ automation, trigger, app: input.app, triggerData, userId: undefined },
          ...(input.depth === undefined ? {} : { recordEventDepth: input.depth }),
        }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.tapCause((cause) => Effect.logError('[automation:signature] dispatch failure', cause)),
    // effect-swallow: the request already moved; a run that cannot start is logged and never undoes it.
    Effect.ignoreCause,
    Effect.withSpan('automations.trigger-signature-event-automations', {
      attributes: { flow: input.flow.name, event: input.signature.event },
    })
  )
