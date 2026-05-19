/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const DelayWebhookActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('delay'),
  operator: Schema.Literal('webhook'),
  props: Schema.Struct({
    callbackId: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description:
            'Custom callback identifier (supports template variables). Auto-generated if not provided.',
        })
      )
    ),

    timeout: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^\d+\s*(ms|s|m|h|d)$/),
        Schema.annotations({
          description:
            'Maximum time to wait for callback: number + unit (ms, s, m, h, d). Examples: "1h", "7d"',
        })
      )
    ),

    onTimeout: Schema.optional(
      Schema.Literal('continue', 'stop', 'error').pipe(
        Schema.annotations({
          description: 'Behavior on timeout: continue, stop, or error (default: error)',
        })
      )
    ),

    expectedData: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description: 'Expected data shape for validating the webhook callback payload',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'DelayWebhookAction',
    title: 'Delay Webhook Action',
    description: 'Pause execution until an external webhook callback is received',
  })
)

export type DelayWebhookAction = Schema.Schema.Type<typeof DelayWebhookActionSchema>
