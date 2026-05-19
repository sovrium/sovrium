/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'

export const DelayQueueActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('delay'),
  operator: Schema.Literal('queue'),
  props: Schema.Struct({
    interval: Schema.String.pipe(
      Schema.pattern(/^\d+\s*(ms|s|m|h)$/),
      Schema.annotations({
        description:
          'Minimum delay between processing each queued item. Format: number + unit (ms, s, m, h)',
        examples: ['500ms', '2s', '1m', '30s'],
      })
    ),

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

export type DelayQueueAction = Schema.Schema.Type<typeof DelayQueueActionSchema>
