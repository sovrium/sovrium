/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const AgentDefinitionSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: (issue) =>
        `Agent name ${JSON.stringify(issue.actual)} must be kebab-case format (lowercase letters, digits, and single hyphens — e.g. 'support-agent').`,
    }),
    Schema.annotations({
      description: 'Unique kebab-case identifier for this agent',
      examples: ['support-agent', 'data-enrichment-bot', 'content-moderator'],
    })
  ),

  role: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Auth role this agent operates as (must exist in auth.roles)',
    })
  ),

  model: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'LLM model override for this agent (defaults to AI_MODEL env var)',
        examples: ['claude-sonnet-4-5', 'gpt-4o-mini'],
      })
    )
  ),

  temperature: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1),
      Schema.annotations({
        description: 'Temperature override for LLM responses (0-1 inclusive)',
      })
    )
  ),

  maxTokens: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum output tokens override (positive integer)',
      })
    )
  ),

  systemPrompt: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'System prompt defining agent personality and behavioral rules',
    })
  ),

  instructions: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.minLength(1),
        Schema.annotations({ description: 'A single behavioral instruction' })
      )
    ).pipe(
      Schema.annotations({
        description:
          'Additional behavioral instructions appended as numbered rules to the system prompt',
      })
    )
  ),

  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Whether agent can execute (defaults to true)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentDefinition',
    title: 'Agent Definition',
    description:
      'Core identity and configuration of an AI agent. Requires auth and AI_PROVIDER to be configured.',
  })
)

export type AgentDefinition = Schema.Schema.Type<typeof AgentDefinitionSchema>
