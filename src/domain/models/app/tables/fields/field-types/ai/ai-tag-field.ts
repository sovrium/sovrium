/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const AiTagFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('ai-tag').pipe(
        Schema.annotations({
          description: "Constant value 'ai-tag' for type discrimination in discriminated unions",
        })
      ),
      sourceFields: Schema.Array(Schema.String).pipe(
        Schema.minItems(1),
        Schema.annotations({
          description: 'Field names used as input context for AI tagging',
        })
      ),
      tags: Schema.Array(Schema.String).pipe(
        Schema.minItems(2),
        Schema.annotations({
          description:
            'Predefined list of allowed tags the AI can assign. Minimum 2 entries, no duplicates.',
          examples: [['technology', 'business', 'science', 'health', 'politics']],
        }),
        Schema.filter((tags) => {
          const unique = new Set(tags)
          return tags.length === unique.size || 'Tags must be unique (duplicate tags found)'
        })
      ),
      maxTags: Schema.optional(
        Schema.Number.pipe(
          Schema.int(),
          Schema.positive(),
          Schema.annotations({
            description:
              'Maximum number of tags to assign. Returns at most N tags. No limit when omitted.',
          })
        )
      ),
      prompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Custom prompt to guide tagging logic. Uses default prompt if omitted.',
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
            description: 'Temperature override (0 to 1) for controlling tagging confidence',
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
    identifier: 'AiTagField',
    title: 'AI Tag Field',
    description:
      'Automatically assigns multiple labels from a predefined set using AI analysis. Output is a text array of matching tags.',
    examples: [
      {
        id: 3,
        name: 'topics',
        type: 'ai-tag',
        sourceFields: ['title', 'body'],
        tags: [
          'technology',
          'business',
          'science',
          'health',
          'politics',
          'entertainment',
          'sports',
        ],
        maxTags: 3,
        computeOn: 'both',
      },
      {
        id: 4,
        name: 'content_flags',
        type: 'ai-tag',
        sourceFields: ['body'],
        tags: [
          'contains-statistics',
          'contains-quotes',
          'opinion-piece',
          'breaking-news',
          'evergreen',
        ],
        prompt: 'Identify which content characteristics apply to this article',
        computeOn: 'create',
      },
    ],
  })
)

export type AiTagField = Schema.Schema.Type<typeof AiTagFieldSchema>
