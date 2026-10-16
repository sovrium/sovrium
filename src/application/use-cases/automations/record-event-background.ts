/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { identifyRequester } from './requester-identity'
import { triggerRecordEventAutomations, type TriggerRecordEventInput } from './trigger-record-event'

/**
 * The events, each carrying an `identify` that looks its requester's account up
 * at most ONCE per requester id across the whole list: a batch of N rows written
 * by one person reads that person's email and name once, not N times. The lookup
 * stays lazy — `Effect.cached` runs it on the first event whose automation
 * matches, and never when none does. Each event keeps its own requester (id and
 * role); only the looked-up email and name are shared.
 */
export const shareRequesterLookups = Effect.fn('automations.share-requester-lookups')(function* (
  inputs: readonly TriggerRecordEventInput[]
) {
  const firstByPerson = new Map(
    inputs.flatMap((input) =>
      input.requester === undefined ? [] : [[input.requester.id, input.requester] as const]
    )
  )
  const lookups = new Map(
    yield* Effect.forEach([...firstByPerson.values()], (requester) =>
      Effect.map(
        Effect.cached(identifyRequester(requester)),
        (lookup) => [requester.id, lookup] as const
      )
    )
  )
  return inputs.map((input): TriggerRecordEventInput => {
    const { requester } = input
    const lookup = requester === undefined ? undefined : lookups.get(requester.id)
    if (requester === undefined || lookup === undefined) return input
    return {
      ...input,
      identify: Effect.map(lookup, (person) => ({
        ...requester,
        email: person.email ?? '',
        name: person.name ?? '',
      })),
    }
  })
})

/**
 * Start the record automations of these events in ONE tracked background fiber,
 * one event after another, and return at once: the road that wrote the rows
 * answers once they are committed, whatever the runs take. Tracking is what
 * lets a stopping server wait for the runs or close them as stopped. The fiber
 * keeps the services of the program that started it — the server's, never a
 * request's — and each run still takes its automation's concurrency slot.
 */
export const startRecordEventAutomationsInBackground = (
  inputs: readonly TriggerRecordEventInput[]
) =>
  AutomationFiberBridge.use((bridge) =>
    Effect.asVoid(
      Effect.forkDetach(
        bridge.trackBackground(
          Effect.flatMap(shareRequesterLookups(inputs), (shared) =>
            Effect.forEach(shared, triggerRecordEventAutomations, { discard: true })
          )
        )
      )
    )
  ).pipe(
    Effect.withSpan('automations.start-record-event-automations-in-background', {
      attributes: { events: inputs.length },
    })
  )
