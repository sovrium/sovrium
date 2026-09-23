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
  type: Schema.Literal('ai').pipe(
    Schema.annotate({
      description: "Constant value 'ai' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('agent').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'ai' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** Agent name referencing app.agents[].name */
    agent: Schema.String.pipe(
      Schema.annotate({
        description:
          'Agent name (must reference app.agents[].name). Lowercase alphanumeric with hyphens.',
      }),
      Schema.check(Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/))
    ),

    /** Task description for the agent */
    task: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Task description for the agent to execute (supports template variables)',
      })
    ),

    /** Additional context data for the agent */
    context: Schema.optional(
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({
          description: 'Additional context data passed to the agent as key-value pairs',
        })
      )
    ),

    /** Maximum number of steps the agent can take */
    maxSteps: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum number of steps the agent can take (1-100, default: 10)',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }))
      )
    ),

    /** Response format */
    responseFormat: Schema.optional(
      Schema.Literals(['text', 'json']).pipe(
        Schema.annotate({
          description: 'Response format: text (default) or json',
        })
      )
    ),

    /** Timeout in seconds */
    timeout: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Timeout in seconds for agent execution',
        }),
        Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
      )
    ),

    /** Connection name for API authentication */
    connection: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Connection name for API auth (must reference app.connections[])',
        }),
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
      )
    ),
  }).annotate({
    description:
      'What the agent is asked to do: which agent, the task, any context it is given, and the limits on how far it may go.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AiAgentAction',
    title: 'AI Agent Action',
    description: 'Delegate a task to an AI agent for autonomous multi-step execution',
  })
)

/** @public */
export type AiAgentAction = Schema.Schema.Type<typeof AiAgentActionSchema>
