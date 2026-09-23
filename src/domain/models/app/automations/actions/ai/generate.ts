/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { AiActionProviderSchema } from './provider'

/**
 * AI Generate Action (type: ai, operator: generate)
 *
 * Generate text using a language model. Supports cloud providers
 * (OpenAI, Anthropic) and self-hosted models (Ollama) for digital sovereignty.
 */
export const AiGenerateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai').pipe(
    Schema.annotate({
      description: "Constant value 'ai' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('generate').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'ai' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** LLM provider — optional, advisory (see {@link AiActionProviderSchema}) */
    provider: AiActionProviderSchema,

    /** Model identifier */
    model: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Model name (e.g., "gpt-4o", "claude-sonnet-4-20250514", "llama3")',
      })
    ),

    /** User prompt */
    prompt: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'User prompt sent to the model (supports template variables)',
      })
    ),

    /** System prompt */
    systemPrompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'System prompt to set model behavior and context',
        })
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

    /** Sampling temperature */
    temperature: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Sampling temperature (0-2, default: provider default)',
        }),
        Schema.check(Schema.isBetween({ minimum: 0, maximum: 2 }))
      )
    ),

    /** Maximum tokens to generate */
    maxTokens: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum tokens to generate (1-1000000)',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1_000_000 }))
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
  }).annotate({
    description: 'What to generate: the prompt, the model, and the limits on the answer.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AiGenerateAction',
    title: 'AI Generate Action',
    description: 'Generate text using a language model (cloud or self-hosted)',
  })
)

/** @public */
export type AiGenerateAction = Schema.Schema.Type<typeof AiGenerateActionSchema>
