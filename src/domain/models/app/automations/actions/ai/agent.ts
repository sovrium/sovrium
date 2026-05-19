/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const AiAgentActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai'),
  operator: Schema.Literal('agent'),
  props: Schema.Struct({
    agent: Schema.String.pipe(
      Schema.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      Schema.annotations({
        description:
          'Agent name (must reference app.agents[].name). Lowercase alphanumeric with hyphens.',
      })
    ),

    task: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Task description for the agent to execute (supports template variables)',
      })
    ),

    context: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description: 'Additional context data passed to the agent as key-value pairs',
        })
      )
    ),

    maxSteps: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 100),
        Schema.annotations({
          description: 'Maximum number of steps the agent can take (1-100, default: 10)',
        })
      )
    ),

    responseFormat: Schema.optional(
      Schema.Literal('text', 'json').pipe(
        Schema.annotations({
          description: 'Response format: text (default) or json',
        })
      )
    ),

    timeout: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.positive(),
        Schema.annotations({
          description: 'Timeout in seconds for agent execution',
        })
      )
    ),

    connection: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-z][a-z0-9-]*$/),
        Schema.annotations({
          description: 'Connection name for API auth (must reference app.connections[])',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AiAgentAction',
    title: 'AI Agent Action',
    description: 'Delegate a task to an AI agent for autonomous multi-step execution',
  })
)

export type AiAgentAction = Schema.Schema.Type<typeof AiAgentActionSchema>
