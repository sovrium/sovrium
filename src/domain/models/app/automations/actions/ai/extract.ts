/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const AiExtractActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai'),
  operator: Schema.Literal('extract'),
  props: Schema.Struct({
    provider: Schema.Literal('openai', 'anthropic', 'ollama', 'custom').pipe(
      Schema.annotations({
        description: 'LLM provider: openai, anthropic, ollama (self-hosted), or custom',
      })
    ),

    model: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Model name (e.g., "gpt-4o", "claude-sonnet-4-20250514")',
      })
    ),

    input: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Text input to extract data from (supports template variables)',
      })
    ),

    schema: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({
        description:
          'JSON Schema describing the extraction output. Example: { "name": "string", "email": "string", "age": "number" }',
      })
    ),

    prompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description:
            'Optional instruction prepended to the input + schema sent to the model (supports template variables)',
        })
      )
    ),

    systemPrompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'System prompt to set model behavior and context',
        })
      )
    ),

    temperature: Schema.optional(
      Schema.Number.pipe(
        Schema.between(0, 2),
        Schema.annotations({
          description: 'Sampling temperature (0-2, default: provider default)',
        })
      )
    ),

    maxTokens: Schema.optional(
      Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 1_000_000),
        Schema.annotations({
          description: 'Maximum tokens to generate (1-1000000)',
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
    identifier: 'AiExtractAction',
    title: 'AI Extract Action',
    description: 'Extract structured data from text using a language model and JSON Schema',
  })
)

export type AiExtractAction = Schema.Schema.Type<typeof AiExtractActionSchema>
