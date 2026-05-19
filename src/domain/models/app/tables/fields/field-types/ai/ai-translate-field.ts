/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const AiTranslateFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('ai-translate').pipe(
        Schema.annotations({
          description:
            "Constant value 'ai-translate' for type discrimination in discriminated unions",
        })
      ),
      sourceFields: Schema.Array(Schema.String).pipe(
        Schema.minItems(1, {
          message: () => 'ai-translate sourceFields must contain exactly one (single) field name',
        }),
        Schema.maxItems(1, {
          message: () => 'ai-translate sourceFields must contain exactly one (single) field name',
        }),
        Schema.annotations({
          description: 'Source field for translation. Must contain exactly one field name.',
        })
      ),
      targetLanguage: Schema.String.pipe(
        Schema.pattern(/^[a-z]{2}(-[A-Z]{2})?$/, {
          message: () =>
            'ai-translate targetLanguage is required and must be an ISO 639-1 language code (e.g., fr, es, de, ja, zh-CN)',
        }),
        Schema.annotations({
          description:
            'ISO 639-1 language code for the target language (e.g., fr, es, de, ja, zh-CN)',
          examples: ['fr', 'es', 'de', 'ja', 'zh-CN'],
        })
      ),
      prompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description:
              'Custom prompt to control translation tone, formality, and style. Uses default prompt if omitted.',
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
            description: 'Temperature override (0 to 1) for controlling translation creativity',
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

export type AiTranslateField = Schema.Schema.Type<typeof AiTranslateFieldSchema>
