/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'

export const AiGenerateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('ai'),
  operator: Schema.Literal('generate'),
  props: Schema.Struct({
    provider: Schema.Literal('openai', 'anthropic', 'ollama', 'custom').pipe(
      Schema.annotations({
        description: 'LLM provider: openai, anthropic, ollama (self-hosted), or custom',
      })
    ),

    model: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'Model name (e.g., "gpt-4o", "claude-sonnet-4-20250514", "llama3")',
      })
    ),

    prompt: TemplateStringSchema.pipe(
      Schema.annotations({
        description: 'User prompt sent to the model (supports template variables)',
      })
    ),

    systemPrompt: Schema.optional(
      TemplateStringSchema.pipe(
        Schema.annotations({
          description: 'System prompt to set model behavior and context',
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

    responseFormat: Schema.optional(
      Schema.Literal('text', 'json').pipe(
        Schema.annotations({
          description: 'Response format: text (default) or json',
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

export type AiGenerateAction = Schema.Schema.Type<typeof AiGenerateActionSchema>
