/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * AI Categorize Field
 *
 * Automatically classifies records into exactly one category from a predefined list
 * using AI analysis of source fields. Ideal for triage, routing, and priority
 * assignment without manual labeling.
 *
 * Business Rules:
 * - Output is always a single value from the `categories` list (never free-form)
 * - Minimum 2 categories required; duplicates are rejected
 * - Returns NULL when all source fields are empty or NULL
 * - Falls back to NULL with error logged if AI returns value outside categories list
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 3,
 *   name: 'department',
 *   type: 'ai-categorize',
 *   sourceFields: ['subject', 'description'],
 *   categories: ['billing', 'technical', 'account', 'general'],
 *   computeOn: 'create',
 * }
 * ```
 */
export const AiCategorizeFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('ai-categorize').pipe(
      Schema.annotate({
        description:
          "Constant value 'ai-categorize' for type discrimination in discriminated unions",
      })
    ),
    sourceFields: Schema.Array(Schema.String).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Field names used as input context for AI classification',
      })
    ),
    categories: Schema.Array(Schema.String).pipe(
      Schema.check(Schema.isMinLength(2)),
      Schema.annotate({
        description:
          'Predefined list of categories the AI must choose from. Minimum 2 entries, no duplicates.',
        examples: [['billing', 'technical', 'account', 'general']],
      }),
      Schema.check(
        Schema.makeFilter((categories) => {
          const unique = new Set(categories)
          return (
            categories.length === unique.size ||
            'Categories must be unique (duplicate categories found)'
          )
        })
      )
    ),
    prompt: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Custom prompt to guide classification logic. Uses default prompt if omitted.',
        })
      )
    ),
    systemPrompt: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'System prompt for setting AI persona and context',
        })
      )
    ),
    model: Schema.optional(
      Schema.String.pipe(
        Schema.check(
          Schema.isMinLength(1, {
            message: 'AI field model override must be a non-empty string',
          })
        ),
        Schema.annotate({
          description: 'AI model override (e.g., gpt-4o, claude-sonnet)',
        })
      )
    ),
    temperature: Schema.optional(
      Schema.Finite.pipe(
        Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1)),
        Schema.annotate({
          description: 'Temperature override (0 to 1) for controlling classification confidence',
        })
      )
    ),
    maxTokens: Schema.optional(
      Schema.Finite.pipe(
        Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
        Schema.annotate({
          description: 'Maximum tokens for AI response',
        })
      )
    ),
    computeOn: Schema.Literals(['create', 'update', 'both']).pipe(
      Schema.annotate({
        description: 'When to compute the AI field: on record creation, update, or both',
      })
    ),
  }),
  Schema.annotate({
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

/** @public */
export type AiCategorizeField = Schema.Schema.Type<typeof AiCategorizeFieldSchema>
