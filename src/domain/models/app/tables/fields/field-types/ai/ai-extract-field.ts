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
  Schema.fieldsAssign({
    type: Schema.Literal('ai-extract').pipe(
      Schema.annotate({
        description: "Constant value 'ai-extract' for type discrimination in discriminated unions",
      })
    ),
    sourceFields: Schema.Array(
      Schema.String.annotate({
        description: 'One field of this table whose value is fed to the model as input.',
      })
    ).pipe(
      Schema.annotate({
        description: 'Field names used as input context for AI extraction',
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    schema: Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({
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
        Schema.annotate({
          description: 'Custom prompt to guide extraction focus. Uses default prompt if omitted.',
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
          description:
            'Temperature override (0 to 1). Low values recommended for accurate extraction.',
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
