/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

/**
 * Delay Queue Action (type: delay, operator: queue)
 *
 * Holds incoming automation runs and processes them one at a time in
 * FIFO order with a configurable delay between each item. This is
 * distinct from per-automation `concurrency` config: concurrency
 * controls how many _runs_ execute simultaneously, while the queue
 * delay is an _in-workflow bottleneck_ that spaces out actions within
 * or across runs.
 *
 * Use cases:
 * - Rate-limited APIs: Space out API calls to stay under limits
 * - Sequential processing: Ensure FIFO order with guaranteed spacing
 * - Batch throttling: Process webhook bursts at a controlled pace
 *
 * @example
 * ```yaml
 * actions:
 *   - name: throttle
 *     type: delay
 *     operator: queue
 *     props:
 *       interval: '2s'
 *       maxQueueSize: 1000
 * ```
 */
export const DelayQueueActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('delay'),
  operator: Schema.Literal('queue'),
  props: Schema.Struct({
    /**
     * Minimum time between processing each queued item.
     * Format: number + unit (ms, s, m, h)
     * Examples: "500ms", "2s", "1m"
     */
    interval: Schema.String.pipe(
      Schema.pattern(/^\d+\s*(ms|s|m|h)$/),
      Schema.annotations({
        description:
          'Minimum delay between processing each queued item. Format: number + unit (ms, s, m, h)',
        examples: ['500ms', '2s', '1m', '30s'],
      })
    ),

    /**
     * Maximum number of items that can be queued. When the queue is full
     * new items are rejected with a "queue full" error. Defaults to
     * unlimited when omitted.
     */
    maxQueueSize: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.positive(),
        Schema.annotations({
          description: 'Max items in queue before rejecting new entries (default: unlimited)',
          examples: [100, 1000, 10_000],
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DelayQueueAction',
    title: 'Delay Queue Action',
    description:
      'Process queued automation items one at a time with configurable spacing for rate-limited APIs',
  })
)

/** @public */
export type DelayQueueAction = Schema.Schema.Type<typeof DelayQueueActionSchema>
