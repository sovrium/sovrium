/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { triggerRecordEventAutomations, type TriggerRecordEventInput } from './trigger-record-event'

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
          Effect.forEach(inputs, triggerRecordEventAutomations, { discard: true })
        )
      )
    )
  ).pipe(
    Effect.withSpan('automations.start-record-event-automations-in-background', {
      attributes: { events: inputs.length },
    })
  )
