/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * AI Translate Field
 *
 * Automatically translates content from a source field into a target language
 * using AI. Ideal for maintaining multilingual records without manual translation.
 *
 * Business Rules:
 * - `targetLanguage` is required and must be an ISO 639-1 language code
 * - `sourceFields` must contain exactly one field (translate operates on a single source)
 * - Output is PostgreSQL TEXT
 * - Returns NULL when the source field is empty or NULL
 * - Supports custom prompt to control translation tone, formality, and style
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 2,
 *   name: 'description_fr',
 *   type: 'ai-translate',
 *   sourceFields: ['description_en'],
 *   targetLanguage: 'fr',
 *   computeOn: 'both',
 * }
 * ```
 */
export const AiTranslateFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('ai-translate').pipe(
      Schema.annotate({
        description:
          "Constant value 'ai-translate' for type discrimination in discriminated unions",
      })
    ),
    sourceFields: Schema.Array(Schema.String).pipe(
      Schema.check(
        Schema.isMinLength(1, {
          message: 'ai-translate sourceFields must contain exactly one (single) field name',
        }),
        Schema.isMaxLength(1, {
          message: 'ai-translate sourceFields must contain exactly one (single) field name',
        })
      ),
      Schema.annotate({
        description: 'Source field for translation. Must contain exactly one field name.',
      })
    ),
    targetLanguage: Schema.String.pipe(
      Schema.check(
        Schema.isPattern(/^[a-z]{2}(-[A-Z]{2})?$/, {
          message:
            'ai-translate targetLanguage is required and must be an ISO 639-1 language code (e.g., fr, es, de, ja, zh-CN)',
        })
      ),
      Schema.annotate({
        description:
          'ISO 639-1 language code for the target language (e.g., fr, es, de, ja, zh-CN)',
        examples: ['fr', 'es', 'de', 'ja', 'zh-CN'],
      })
    ),
    prompt: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Custom prompt to control translation tone, formality, and style. Uses default prompt if omitted.',
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
          description: 'Temperature override (0 to 1) for controlling translation creativity',
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
    identifier: 'AiTranslateField',
    title: 'AI Translate Field',
    description:
      'Automatically translates content from a source field into a target language using AI.',
    examples: [
      {
        id: 2,
        name: 'description_fr',
        type: 'ai-translate',
        sourceFields: ['description_en'],
        targetLanguage: 'fr',
        computeOn: 'both',
      },
      {
        id: 4,
        name: 'description_de',
        type: 'ai-translate',
        sourceFields: ['description_en'],
        targetLanguage: 'de',
        prompt:
          'Translate the following product description to German. Use formal tone (Sie) and metric units.',
        temperature: 0.3,
        computeOn: 'both',
      },
    ],
  })
)

/** @public */
export type AiTranslateField = Schema.Schema.Type<typeof AiTranslateFieldSchema>
