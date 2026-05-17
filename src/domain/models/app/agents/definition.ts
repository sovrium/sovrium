/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * AgentDefinitionSchema defines the core identity and configuration of an AI agent.
 *
 * Each agent has a unique kebab-case name, operates under an auth role,
 * and is driven by a system prompt with optional behavioral instructions.
 * Model parameters (model, temperature, maxTokens) can override global
 * AI environment variables on a per-agent basis.
 *
 * Requires `auth` to be configured in the app schema and `AI_PROVIDER` env var to be set.
 */
export const AgentDefinitionSchema = Schema.Struct({
  /** Unique kebab-case identifier for this agent */
  name: Schema.String.pipe(
    Schema.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    Schema.annotations({
      description: 'Unique kebab-case identifier for this agent',
      examples: ['support-agent', 'data-enrichment-bot', 'content-moderator'],
    })
  ),

  /** Auth role this agent operates as (must reference a role defined in auth.roles) */
  role: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Auth role this agent operates as (must exist in auth.roles)',
    })
  ),

  /** LLM model override for this agent (defaults to AI_MODEL env var) */
  model: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'LLM model override for this agent (defaults to AI_MODEL env var)',
        examples: ['claude-sonnet-4-5', 'gpt-4o-mini'],
      })
    )
  ),

  /** Temperature override (0-1 inclusive, defaults to AI_TEMPERATURE env var) */
  temperature: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1),
      Schema.annotations({
        description: 'Temperature override for LLM responses (0-1 inclusive)',
      })
    )
  ),

  /** Max output tokens override (defaults to AI_MAX_TOKENS env var) */
  maxTokens: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum output tokens override (positive integer)',
      })
    )
  ),

  /** System prompt defining agent personality, role, and rules */
  systemPrompt: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'System prompt defining agent personality and behavioral rules',
    })
  ),

  /** Additional behavioral instructions appended as numbered rules to the system prompt */
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

  /** Whether this agent is active (defaults to true) */
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

/** @public */
export type AgentDefinition = Schema.Schema.Type<typeof AgentDefinitionSchema>
