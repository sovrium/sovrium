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
 * AI Generate Action (type: ai, operator: generate)
 *
 * Generate text using a language model. Supports cloud providers
 * (OpenAI, Anthropic) and self-hosted models (Ollama) for digital sovereignty.
 */
export const AiGenerateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai'),
  operator: Schema.Literal('generate'),
  props: Schema.Struct({
    /** LLM provider */
    provider: Schema.Literal('openai', 'anthropic', 'ollama', 'custom').pipe(
      Schema.annotations({
        description: 'LLM provider: openai, anthropic, ollama (self-hosted), or custom',
      })
    ),

    /** Model identifier */
    model: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Model name (e.g., "gpt-4o", "claude-sonnet-4-20250514", "llama3")',
      })
    ),

    /** User prompt */
    prompt: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'User prompt sent to the model (supports template variables)',
      })
    ),

    /** System prompt */
    systemPrompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'System prompt to set model behavior and context',
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

    /** Sampling temperature */
    temperature: Schema.optional(
      Schema.Number.pipe(
        Schema.between(0, 2),
        Schema.annotations({
          description: 'Sampling temperature (0-2, default: provider default)',
        })
      )
    ),

    /** Maximum tokens to generate */
    maxTokens: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 1_000_000),
        Schema.annotations({
          description: 'Maximum tokens to generate (1-1000000)',
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

    /** Custom base URL for self-hosted or custom providers */
    baseUrl: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'Base URL for ollama/custom providers (e.g., "http://localhost:11434")',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'AiGenerateAction',
    title: 'AI Generate Action',
    description: 'Generate text using a language model (cloud or self-hosted)',
  })
)

/** @public */
export type AiGenerateAction = Schema.Schema.Type<typeof AiGenerateActionSchema>
