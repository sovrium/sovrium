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
    // v3 built this message from the offending value via a `(issue) => ...`
    // thunk. v4 filter messages are string-keyed annotations that "no longer
    // receive the old ParseIssue callback shape" (migration/v3-to-v4.md:14394),
    // so the thunk has no direct equivalent — but a `makeFilter` PREDICATE does
    // receive the value and may return a string, which becomes the message.
    // That recovers the interpolation.
    //
    // BOTH checks are required, and THE ORDER IS LOAD-BEARING — all four
    // combinations were probed:
    //   isPattern alone .................. keeps JSON Schema `pattern`, loses the value
    //   makeFilter alone ................. keeps the value, SILENTLY DROPS `pattern`
    //                                      from the published app.json
    //   isPattern then makeFilter ........ keeps `pattern`; isPattern
    //                                      short-circuits so the value is lost
    //   makeFilter then isPattern (this) . keeps BOTH
    //
    // The dropped-`pattern` case is the dangerous one: app.json is the contract
    // config authors' editors consume, and losing a constraint there is
    // invisible to `tsc` and to every drift check. Verified that this form's
    // JSON Schema is byte-identical to the plain-`isPattern` output and that
    // accept/reject matches across the boundary cases.
    Schema.check(
      Schema.makeFilter((value) =>
        /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)
          ? true
          : `Agent name ${JSON.stringify(value)} must be kebab-case format (lowercase letters, digits, and single hyphens — e.g. 'support-agent').`
      ),
      Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    ),
    Schema.annotate({
      description: 'Unique kebab-case identifier for this agent',
      examples: ['support-agent', 'data-enrichment-bot', 'content-moderator'],
    })
  ),

  /** Auth role this agent operates as (must reference a role defined in auth.roles) */
  role: Schema.String.pipe(
    Schema.annotate({
      description: 'Auth role this agent operates as (must exist in auth.roles)',
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** LLM model override for this agent (defaults to AI_MODEL env var) */
  model: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'the AI_MODEL environment variable',
        description: 'LLM model override for this agent (defaults to AI_MODEL env var)',
        examples: ['claude-sonnet-4-5', 'gpt-4o-mini'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Temperature override (0-1 inclusive, defaults to AI_TEMPERATURE env var) */
  temperature: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: 'the AI_TEMPERATURE environment variable',
        description: 'Temperature override for LLM responses (0-1 inclusive)',
      }),
      Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))
    )
  ),

  /** Max output tokens override (defaults to AI_MAX_TOKENS env var) */
  maxTokens: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: 'the AI_MAX_TOKENS environment variable',
        description: 'Maximum output tokens override (positive integer)',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** System prompt defining agent personality, role, and rules */
  systemPrompt: Schema.String.pipe(
    Schema.annotate({
      description: 'System prompt defining agent personality and behavioral rules',
    }),
    Schema.check(Schema.isMinLength(1))
  ),

  /** Additional behavioral instructions appended as numbered rules to the system prompt */
  instructions: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'A single behavioral instruction' }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
        description:
          'Additional behavioral instructions appended as numbered rules to the system prompt',
      })
    )
  ),

  /** Whether this agent is active (defaults to true) */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'true',
        description: 'Whether agent can execute (defaults to true)',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'AgentDefinition',
    title: 'Agent Definition',
    description:
      'Core identity and configuration of an AI agent. Requires auth and AI_PROVIDER to be configured.',
  })
)

/** @public */
export type AgentDefinition = Schema.Schema.Type<typeof AgentDefinitionSchema>
