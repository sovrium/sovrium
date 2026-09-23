/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

/**
 * Delay Webhook Action (type: delay, operator: webhook)
 *
 * Pause automation execution until an external webhook callback is received.
 * Supports timeout configuration and expected data validation.
 * Useful for human-in-the-loop workflows and external system integrations.
 */
export const DelayWebhookActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('delay').pipe(
    Schema.annotate({
      description: "Constant value 'delay' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('webhook').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'delay' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Custom callback identifier (auto-generated if not provided) */
    callbackId: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Custom callback identifier (supports template variables). Auto-generated if not provided.',
        })
      )
    ),

    /** Maximum time to wait for the callback */
    timeout: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Maximum time to wait for callback: number + unit (ms, s, m, h, d). Examples: "1h", "7d"',
        }),
        Schema.check(Schema.isPattern(/^\d+\s*(ms|s|m|h|d)$/))
      )
    ),

    /** Behavior when timeout is reached */
    onTimeout: Schema.optional(
      Schema.Literals(['continue', 'stop', 'error']).pipe(
        Schema.annotate({
          description: 'Behavior on timeout: continue, stop, or error (default: error)',
        })
      )
    ),

    /** Expected data shape for callback payload validation */
    expectedData: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({
          description: 'Expected data shape for validating the webhook callback payload',
        })
      )
    ),
  }).annotate({
    description:
      'Which callback to wait for, how long to wait, and what to do if it never arrives.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'DelayWebhookAction',
    title: 'Delay Webhook Action',
    description: 'Pause execution until an external webhook callback is received',
  })
)

/** @public */
export type DelayWebhookAction = Schema.Schema.Type<typeof DelayWebhookActionSchema>
