/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  WebhookOutboxScope,
  type OutboxedWrite,
  type OutboxPlanner,
  type RecordedDeliveries,
} from '@/application/ports/services/record-webhook-dispatcher'

/** Run `write` with an outbox scope installed, and collect the ids its transactions recorded. */
export const enqueue = <A, E, R>(plan: OutboxPlanner, write: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const outer = yield* WebhookOutboxScope
    // A nested scope records into the outer one, which delivers once.
    if (outer.active) {
      const nested: OutboxedWrite<A> = { value: yield* write, changes: [], deliveryIds: [] }
      return nested
    }
    // The scope's own buffer: the repositories hand it what they committed.
    const recorded: { list: readonly RecordedDeliveries[] } = { list: [] }
    const value = yield* write.pipe(
      Effect.provideService(WebhookOutboxScope, {
        active: true,
        plan,
        recorded: (committed) => {
          recorded.list = [...recorded.list, committed]
        },
      })
    )
    const outcome: OutboxedWrite<A> = {
      value,
      changes: recorded.list.flatMap((committed) => committed.changes),
      deliveryIds: recorded.list.flatMap((committed) => committed.deliveryIds),
    }
    return outcome
  })
