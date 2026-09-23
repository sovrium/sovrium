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
 * AI Classify Action (type: ai, operator: classify)
 *
 * Classify text into one of the provided categories using a language model.
 * Returns the selected category as the step output.
 */
export const AiClassifyActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai').pipe(
    Schema.annotate({
      description: "Constant value 'ai' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('classify').pipe(
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
        description: 'Model name (e.g., "gpt-4o-mini", "claude-haiku-4-5-20251001")',
      })
    ),

    /** Text to classify */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Text input to classify (supports template variables)',
      })
    ),

    /** Classification categories (minimum 2) */
    categories: Schema.Array(Schema.String).pipe(
      Schema.annotate({
        description:
          'Categories to classify into (minimum 2). Example: ["positive", "negative", "neutral"]',
      }),
      Schema.check(Schema.isMinLength(2))
    ),

    /** Instruction prepended to the classification request */
    prompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Optional instruction prepended to the input + categories sent to the model (supports template variables)',
        })
      )
    ),

    /** System prompt */
    systemPrompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description: 'System prompt to set model behavior and context',
        })
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
    description: 'What to classify, the categories to choose from, and which model is asked.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AiClassifyAction',
    title: 'AI Classify Action',
    description: 'Classify text into categories using a language model',
  })
)

/** @public */
export type AiClassifyAction = Schema.Schema.Type<typeof AiClassifyActionSchema>
