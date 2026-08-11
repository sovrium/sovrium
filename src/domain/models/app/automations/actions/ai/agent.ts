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
 * AI Agent Action (type: ai, operator: agent)
 *
 * Delegate a task to an AI agent defined in the app configuration.
 * The agent can execute multiple steps autonomously to complete the task,
 * using available tools and context.
 */
export const AiAgentActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai'),
  operator: Schema.Literal('agent'),
  props: Schema.Struct({
    /** Agent name referencing app.agents[].name */
    agent: Schema.String.pipe(
      Schema.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      Schema.annotations({
        description:
          'Agent name (must reference app.agents[].name). Lowercase alphanumeric with hyphens.',
      })
    ),

    /** Task description for the agent */
    task: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Task description for the agent to execute (supports template variables)',
      })
    ),

    /** Additional context data for the agent */
    context: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description: 'Additional context data passed to the agent as key-value pairs',
        })
      )
    ),

    /** Maximum number of steps the agent can take */
    maxSteps: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 100),
        Schema.annotations({
          description: 'Maximum number of steps the agent can take (1-100, default: 10)',
        })
      )
    ),

    /** Response format */
    responseFormat: Schema.optional(
      Schema.Literal('text', 'json').pipe(
        Schema.annotations({
          description: 'Response format: text (default) or json',
        })
      )
    ),

    /** Timeout in seconds */
    timeout: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.positive(),
        Schema.annotations({
          description: 'Timeout in seconds for agent execution',
        })
      )
    ),

    /** Connection name for API authentication */
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

/** @public */
export type AiAgentAction = Schema.Schema.Type<typeof AiAgentActionSchema>
