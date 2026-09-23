/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * AI Tag Field
 *
 * Automatically assigns multiple labels from a predefined set using AI analysis.
 * Output is a PostgreSQL text array (VARCHAR[]) containing zero or more tags from
 * the allowed list. Ideal for auto-tagging records for filtering and organization.
 *
 * Business Rules:
 * - Output values are always from the `tags` list (never free-form)
 * - Minimum 2 tags required in the definition; duplicates are rejected
 * - Respects `maxTags` constraint; returns at most N tags
 * - Defaults to no tag limit when `maxTags` is omitted
 * - Filters out any AI-returned values not in the `tags` list (silent discard)
 * - Returns empty array when all source fields are empty or NULL
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 3,
 *   name: 'topics',
 *   type: 'ai-tag',
 *   sourceFields: ['title', 'body'],
 *   tags: ['technology', 'business', 'science', 'health'],
 *   maxTags: 3,
 *   computeOn: 'both',
 * }
 * ```
 */
export const AiTagFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('ai-tag').pipe(
      Schema.annotate({
        description: "Constant value 'ai-tag' for type discrimination in discriminated unions",
      })
    ),
    sourceFields: Schema.Array(
      Schema.String.annotate({
        description: 'One field of this table whose value is fed to the model as input.',
      })
    ).pipe(
      Schema.annotate({
        description: 'Field names used as input context for AI tagging',
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    tags: Schema.Array(
      Schema.String.annotate({
        description: 'One tag the model may choose from. The model is constrained to this list.',
      })
    ).pipe(
      Schema.annotate({
        description:
          'Predefined list of allowed tags the AI can assign. Minimum 2 entries, no duplicates.',
        examples: [['technology', 'business', 'science', 'health', 'politics']],
      }),
      Schema.check(Schema.isMinLength(2)),
      Schema.check(
        Schema.makeFilter((tags) => {
          const unique = new Set(tags)
          return tags.length === unique.size || 'Tags must be unique (duplicate tags found)'
        })
      )
    ),
    maxTags: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description:
            'Maximum number of tags to assign. Returns at most N tags. No limit when omitted.',
        }),
        Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
      )
    ),
    prompt: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Custom prompt to guide tagging logic. Uses default prompt if omitted.',
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
        Schema.annotate({
          description: 'AI model override (e.g., gpt-4o, claude-sonnet)',
        }),
        Schema.check(
          Schema.isMinLength(1, {
            message: 'AI field model override must be a non-empty string',
          })
        )
      )
    ),
    temperature: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Temperature override (0 to 1) for controlling tagging confidence',
        }),
        Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))
      )
    ),
    maxTokens: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum tokens for AI response',
        }),
        Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
      )
    ),
    computeOn: Schema.Literals(['create', 'update', 'both']).pipe(
      Schema.annotate({
        description: 'When to compute the AI field: on record creation, update, or both',
      })
    ),
  }),
  Schema.annotate({
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

/** @public */
export type AiTagField = Schema.Schema.Type<typeof AiTagFieldSchema>
