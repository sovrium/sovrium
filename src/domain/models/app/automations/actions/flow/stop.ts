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
 * Flow Stop Action (type: flow, operator: stop)
 *
 * Immediately stop automation execution. Can indicate success or error status
 * and optionally produce output data for the caller.
 */
export const FlowStopActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('flow'),
  operator: Schema.Literal('stop'),
  props: Schema.Struct({
    /** Human-readable message explaining why execution was stopped */
    message: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'Message explaining why execution was stopped (supports template variables)',
        })
      )
    ),

    /** Stop status: success or error */
    status: Schema.optional(
      Schema.Literals(['success', 'error']).pipe(
        Schema.annotate({
          description: 'Stop status: success or error (default: error)',
        })
      )
    ),

    /** Output data to return to the caller */
    output: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({
          description: 'Output data to return to the caller as key-value pairs',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FlowStopAction',
    title: 'Flow Stop Action',
    description: 'Immediately stop automation execution with optional status and output',
  })
)

/** @public */
export type FlowStopAction = Schema.Schema.Type<typeof FlowStopActionSchema>
