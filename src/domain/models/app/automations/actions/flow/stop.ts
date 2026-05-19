/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const FlowStopActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('flow'),
  operator: Schema.Literal('stop'),
  props: Schema.Struct({
    message: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Message explaining why execution was stopped (supports template variables)',
        })
      )
    ),

    status: Schema.optional(
      Schema.Literal('success', 'error').pipe(
        Schema.annotations({
          description: 'Stop status: success or error (default: error)',
        })
      )
    ),

    output: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description: 'Output data to return to the caller as key-value pairs',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'FlowStopAction',
    title: 'Flow Stop Action',
    description: 'Immediately stop automation execution with optional status and output',
  })
)

export type FlowStopAction = Schema.Schema.Type<typeof FlowStopActionSchema>
