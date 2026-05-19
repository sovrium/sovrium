/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const AiSummaryFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('ai-summary').pipe(
        Schema.annotations({
          description:
            "Constant value 'ai-summary' for type discrimination in discriminated unions",
        })
      ),
      sourceFields: Schema.Array(Schema.String).pipe(
        Schema.minItems(1),
        Schema.annotations({
          description: 'Field names used as input context for summarization',
        })
      ),
      prompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description:
              'Custom prompt to control summarization style. Uses default "Summarize the following" if omitted.',
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
            description: 'Temperature override (0 to 1) for controlling output creativity',
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
      maxLength: Schema.optional(
        Schema.Number.pipe(
          Schema.int(),
          Schema.positive(),
          Schema.annotations({
            description:
              'Maximum character length for the summary. AI output is truncated if exceeded. No limit when omitted.',
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
  Schema.annotations({
    identifier: 'AiSummaryField',
    title: 'AI Summary Field',
    description:
      'Automatically summarizes content from source fields into concise text. Supports configurable max length and custom prompts.',
    examples: [
      {
        id: 4,
        name: 'ticket_summary',
        type: 'ai-summary',
        sourceFields: ['subject', 'description', 'customer_notes'],
        maxLength: 200,
        computeOn: 'both',
      },
      {
        id: 5,
        name: 'executive_brief',
        type: 'ai-summary',
        sourceFields: ['description'],
        prompt: 'Write a one-sentence executive brief for the following support ticket',
        maxLength: 100,
        temperature: 0.3,
        computeOn: 'create',
      },
    ],
  })
)

export type AiSummaryField = Schema.Schema.Type<typeof AiSummaryFieldSchema>
