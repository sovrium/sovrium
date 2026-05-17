/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * AI Sentiment Field
 *
 * Automatically analyzes the emotional tone of text content using AI.
 * Returns structured JSON with label, score, and explanation fields.
 * Ideal for tracking customer satisfaction, feedback polarity, and content mood.
 *
 * Business Rules:
 * - Output is PostgreSQL JSONB with `label`, `score`, and `explanation`
 * - `label` is one of: positive, negative, neutral, mixed
 * - `score` is a float between 0.0 and 1.0 representing confidence
 * - Validates AI output matches expected structure; stores NULL with error if invalid
 * - Returns NULL when all source fields are empty or NULL
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 3,
 *   name: 'sentiment',
 *   type: 'ai-sentiment',
 *   sourceFields: ['review_title', 'review_text'],
 *   computeOn: 'create',
 *   temperature: 0.1,
 * }
 * ```
 */
export const AiSentimentFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('ai-sentiment').pipe(
        Schema.annotations({
          description:
            "Constant value 'ai-sentiment' for type discrimination in discriminated unions",
        })
      ),
      sourceFields: Schema.Array(Schema.String).pipe(
        Schema.minItems(1),
        Schema.annotations({
          description: 'Field names used as input context for sentiment analysis',
        })
      ),
      prompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description:
              'Custom prompt to adjust analysis focus (e.g., urgency, satisfaction). Uses default prompt if omitted.',
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
            description:
              'Temperature override (0 to 1). Low values recommended for consistent analysis.',
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
      computeOn: Schema.optional(
        Schema.Literal('create', 'update', 'both').pipe(
          Schema.annotations({
            description:
              'When to compute the AI field: on record creation, update, or both. Defaults to compute-on-create when omitted.',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    identifier: 'AiSentimentField',
    title: 'AI Sentiment Field',
    description:
      'Analyzes emotional tone of text content, returning structured JSON with label (positive/negative/neutral/mixed), confidence score (0-1), and explanation.',
    examples: [
      {
        id: 3,
        name: 'sentiment',
        type: 'ai-sentiment',
        sourceFields: ['review_title', 'review_text'],
        computeOn: 'create',
        temperature: 0.1,
      },
      {
        id: 4,
        name: 'support_tone',
        type: 'ai-sentiment',
        sourceFields: ['review_text'],
        prompt: "Analyze the customer's emotional state and urgency level in this review",
        computeOn: 'create',
      },
    ],
  })
)

/** @public */
export type AiSentimentField = Schema.Schema.Type<typeof AiSentimentFieldSchema>
