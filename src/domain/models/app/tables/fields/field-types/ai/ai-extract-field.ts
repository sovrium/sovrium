/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * AI Extract Field
 *
 * Pulls structured data from unstructured text into JSON using AI analysis.
 * The output conforms to a user-defined JSON Schema, enabling automatic parsing
 * of entities, attributes, and facts from free-form content.
 *
 * Business Rules:
 * - Output is stored as PostgreSQL JSONB and validated against the defined `schema`
 * - Returns NULL with error if AI output does not match the schema
 * - Supports nested objects and arrays in the schema definition
 * - Handles partial extraction gracefully (missing optional fields set to null)
 * - Returns NULL when all source fields are empty or NULL
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 2,
 *   name: 'extracted_data',
 *   type: 'ai-extract',
 *   sourceFields: ['raw_text'],
 *   schema: {
 *     type: 'object',
 *     properties: {
 *       vendor_name: { type: 'string', description: 'Name of the vendor' },
 *       total_amount: { type: 'number', description: 'Total amount due' },
 *     },
 *   },
 *   computeOn: 'create',
 *   temperature: 0.1,
 * }
 * ```
 */
export const AiExtractFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('ai-extract').pipe(
        Schema.annotations({
          description:
            "Constant value 'ai-extract' for type discrimination in discriminated unions",
        })
      ),
      sourceFields: Schema.Array(Schema.String).pipe(
        Schema.minItems(1),
        Schema.annotations({
          description: 'Field names used as input context for AI extraction',
        })
      ),
      schema: Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description:
            'JSON Schema definition describing the structure of extracted data. Supports nested objects and arrays.',
          examples: [
            {
              type: 'object',
              properties: {
                vendor_name: { type: 'string', description: 'Name of the vendor' },
                total_amount: { type: 'number', description: 'Total amount due' },
              },
            },
          ],
        })
      ),
      prompt: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Custom prompt to guide extraction focus. Uses default prompt if omitted.',
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
              'Temperature override (0 to 1). Low values recommended for accurate extraction.',
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
    identifier: 'AiExtractField',
    title: 'AI Extract Field',
    description:
      'Pulls structured data from unstructured text into JSON using AI analysis, validated against a user-defined JSON Schema.',
    examples: [
      {
        id: 2,
        name: 'extracted_data',
        type: 'ai-extract',
        sourceFields: ['raw_text'],
        schema: {
          type: 'object',
          properties: {
            vendor_name: { type: 'string', description: 'Name of the vendor' },
            total_amount: { type: 'number', description: 'Total amount due' },
          },
        },
        computeOn: 'create',
        temperature: 0.1,
      },
    ],
  })
)

/** @public */
export type AiExtractField = Schema.Schema.Type<typeof AiExtractFieldSchema>
