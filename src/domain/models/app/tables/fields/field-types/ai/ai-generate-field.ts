/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const AiGenerateFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('ai-generate').pipe(
        Schema.annotations({
          description:
            "Constant value 'ai-generate' for type discrimination in discriminated unions",
        })
      ),
      sourceFields: Schema.Array(Schema.String).pipe(
        Schema.minItems(1),
        Schema.annotations({
          description: 'Field names used as input context for AI generation',
        })
      ),
      prompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description:
              'Prompt template with {{fieldName}} variable substitution. Required for generate fields.',
            examples: [
              'Write a compelling 2-paragraph marketing description for {{product_name}}. Key features: {{features}}.',
            ],
          })
        )
      ),
      systemPrompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'System prompt for setting AI persona and context',
          })
        )
      ),
      model: Schema.optional(
        Schema.String.pipe(
          Schema.minLength(1, {
            message: () => 'AI field model override must be a non-empty string',
          }),
          Schema.annotations({
            description: 'AI model override (e.g., gpt-4o, claude-sonnet)',
          })
        )
      ),
      temperature: Schema.optional(
        Schema.Number.pipe(
          Schema.greaterThanOrEqualTo(0),
          Schema.lessThanOrEqualTo(1),
          Schema.annotations({
            description: 'Temperature override (0 to 1) for controlling creativity',
          })
        )
      ),
      maxTokens: Schema.optional(
        Schema.Number.pipe(
          Schema.int(),
          Schema.positive(),
          Schema.annotations({
            description: 'Maximum tokens for generated output. Defaults to no limit when omitted.',
          })
        )
      ),
      computeOn: Schema.optional(
        Schema.Literal('create', 'update', 'both', 'manual').pipe(
          Schema.annotations({
            description:
              'When to compute the AI field: on record creation, update, both, or manual only. Defaults to schema-level behavior when omitted.',
          })
        )
      ),
    })
  ),
  Schema.filter(
    (field) => {
      if (field.prompt === undefined || field.prompt.trim() === '') {
        return 'prompt is required for ai-generate fields'
      }
      const placeholders = [...field.prompt.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map(
        (m) => m[1]
      )
      const sourceSet = new Set<string>(field.sourceFields)
      const missing = placeholders.find((name) => name !== undefined && !sourceSet.has(name))
      return missing === undefined
        ? true
        : `ai-generate prompt references {{${missing}}} which is not found in sourceFields`
    },
    { identifier: 'AiGeneratePromptRequiredAndPlaceholdersInSourceFields' }
  ),
  Schema.annotations({
    identifier: 'AiGenerateField',
    title: 'AI Generate Field',
    description:
      'Produces free-form text from a prompt template with {{fieldName}} variable substitution and source field context.',
    examples: [
      {
        id: 4,
        name: 'marketing_copy',
        type: 'ai-generate',
        sourceFields: ['product_name', 'features', 'target_audience'],
        prompt:
          'Write a compelling 2-paragraph marketing description for {{product_name}}. Key features: {{features}}. Target audience: {{target_audience}}.',
        systemPrompt:
          'You are an expert marketing copywriter. Write engaging, persuasive product descriptions.',
        maxTokens: 500,
        temperature: 0.7,
        computeOn: 'both',
      },
      {
        id: 5,
        name: 'seo_title',
        type: 'ai-generate',
        sourceFields: ['product_name', 'features'],
        prompt:
          'Write an SEO-optimized page title (under 60 characters) for {{product_name}} with features: {{features}}',
        maxTokens: 30,
        temperature: 0.3,
        computeOn: 'create',
      },
    ],
  })
)

export type AiGenerateField = Schema.Schema.Type<typeof AiGenerateFieldSchema>
