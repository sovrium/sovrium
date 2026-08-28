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
 * AI Extract Action (type: ai, operator: extract)
 *
 * Extract structured data from text using a language model.
 * The output conforms to the provided JSON Schema shape.
 */
export const AiExtractActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai'),
  operator: Schema.Literal('extract'),
  props: Schema.Struct({
    /** LLM provider — optional, advisory (see {@link AiActionProviderSchema}) */
    provider: AiActionProviderSchema,

    /** Model identifier */
    model: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Model name (e.g., "gpt-4o", "claude-sonnet-4-20250514")',
      })
    ),

    /** Text to extract from */
    input: TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Text input to extract data from (supports template variables)',
      })
    ),

    /** JSON Schema describing the expected output shape */
    schema: Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({
        description:
          'JSON Schema describing the extraction output. Example: { "name": "string", "email": "string", "age": "number" }',
      })
    ),

    /** Instruction prepended to the extraction request */
    prompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotate({
          description:
            'Optional instruction prepended to the input + schema sent to the model (supports template variables)',
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
        Schema.check(Schema.isBetween({ minimum: 0, maximum: 2 })),
        Schema.annotate({
          description: 'Sampling temperature (0-2, default: provider default)',
        })
      )
    ),

    /** Maximum tokens to generate */
    maxTokens: Schema.optional(
      Schema.Finite.pipe(
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1_000_000 })),
        Schema.annotate({
          description: 'Maximum tokens to generate (1-1000000)',
        })
      )
    ),

    /** Connection name for API authentication */
    connection: Schema.optional(
      Schema.String.pipe(
        Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/)),
        Schema.annotate({
          description: 'Connection name for API auth (must reference app.connections[])',
        })
      )
    ),
  }),
}).pipe(
  Schema.annotate({
    identifier: 'AiExtractAction',
    title: 'AI Extract Action',
    description: 'Extract structured data from text using a language model and JSON Schema',
  })
)

/** @public */
export type AiExtractAction = Schema.Schema.Type<typeof AiExtractActionSchema>
