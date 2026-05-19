/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const AiCategorizeFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('ai-categorize').pipe(
        Schema.annotations({
          description:
            "Constant value 'ai-categorize' for type discrimination in discriminated unions",
        })
      ),
      sourceFields: Schema.Array(Schema.String).pipe(
        Schema.minItems(1),
        Schema.annotations({
          description: 'Field names used as input context for AI classification',
        })
      ),
      categories: Schema.Array(Schema.String).pipe(
        Schema.minItems(2),
        Schema.annotations({
          description:
            'Predefined list of categories the AI must choose from. Minimum 2 entries, no duplicates.',
          examples: [['billing', 'technical', 'account', 'general']],
        }),
        Schema.filter((categories) => {
          const unique = new Set(categories)
          return (
            categories.length === unique.size ||
            'Categories must be unique (duplicate categories found)'
          )
        })
      ),
      prompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description:
              'Custom prompt to guide classification logic. Uses default prompt if omitted.',
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
            description: 'Temperature override (0 to 1) for controlling classification confidence',
          })
        )
      ),
      maxTokens: Schema.optional(
        Schema.Number.pipe(
          Schema.int(),
          Schema.positive(),
          Schema.annotations({
            description: 'Maximum tokens for AI response',
          })
        )
      ),
      computeOn: Schema.Literal('create', 'update', 'both').pipe(
        Schema.annotations({
          description: 'When to compute the AI field: on record creation, update, or both',
        })
      ),
    })
  ),
  Schema.annotations({
    identifier: 'AiCategorizeField',
    title: 'AI Categorize Field',
    description:
      'Automatically classifies records into exactly one category from a predefined list using AI analysis of source fields.',
    examples: [
      {
        id: 3,
        name: 'department',
        type: 'ai-categorize',
        sourceFields: ['subject', 'description'],
        categories: ['billing', 'technical', 'account', 'general'],
        computeOn: 'create',
      },
      {
        id: 4,
        name: 'priority',
        type: 'ai-categorize',
        sourceFields: ['subject', 'description'],
        categories: ['critical', 'high', 'medium', 'low'],
        prompt: 'Assess the urgency of this support ticket and classify its priority',
        temperature: 0.1,
        computeOn: 'create',
      },
    ],
  })
)

export type AiCategorizeField = Schema.Schema.Type<typeof AiCategorizeFieldSchema>
