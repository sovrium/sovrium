/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Known field types that should NOT match UnknownFieldSchema
 */
export const KNOWN_FIELD_TYPES = [
  // AI field types
  'ai-categorize',
  'ai-extract',
  'ai-generate',
  'ai-sentiment',
  'ai-summary',
  'ai-tag',
  'ai-translate',
  // Standard field types
  'array',
  'autonumber',
  'barcode',
  'button',
  'checkbox',
  'code',
  'color',
  'count',
  'created-at',
  'created-by',
  'currency',
  'date',
  'datetime',
  'decimal',
  'deleted-at',
  'deleted-by',
  'duration',
  'email',
  'formula',
  'geolocation',
  'integer',
  'json',
  'long-text',
  'lookup',
  'multi-select',
  'multiple-attachments',
  'percentage',
  'phone-number',
  'progress',
  'rating',
  'relationship',
  'rich-text',
  'rollup',
  'single-attachment',
  'single-line-text',
  'single-select',
  'status',
  'time',
  'updated-at',
  'updated-by',
  'url',
  'user',
] as const

/**
 * Unknown Field Type
 *
 * A DECODE-LEVEL ESCAPE VALVE, not a hole. It exists so `AppSchema` decoding
 * does not fail on an unrecognised `type`; rejecting the value is left to the
 * two layers that can name the offending field.
 *
 * An unrecognised type is refused TWICE, and both were measured, not assumed:
 *
 *   sovrium validate -> `Unknown field type "sinlge-line-text" in field "f"`
 *                       (`detectUnknownFieldTypes`, a live `runPostDecodeChecks` sweep)
 *   sovrium start    -> `Failed to generate CREATE TABLE DDL:
 *                        Unknown field type: sinlge-line-text`
 *
 * An earlier revision of this comment said such a field "passes schema
 * validation" and justified the deferral by "PostgreSQL transaction rollback".
 * Both halves were false: validation rejects it, and SQLite is the default
 * engine. That claim was believed, relayed, and nearly bought a whole work item
 * to fix a defect that does not exist. Verify against the CLI, not this prose.
 *
 * @example
 * ```json
 * {
 *   "id": 1,
 *   "name": "my_field",
 *   "type": "INVALID_TYPE"
 * }
 * ```
 */
export const UnknownFieldSchema = Schema.Struct({
  ...BaseFieldSchema.fields,
  type: Schema.String.pipe(
    // The annotation precedes the check deliberately: piped after one it would
    // land on the check and reach no reader.
    Schema.annotate({
      description:
        'A field type this build does not recognise. The branch exists so an unknown type is reported as an unknown type rather than as a malformed field, and it accepts any string a known type does not already claim.',
    }),
    Schema.check(
      Schema.makeFilter(
        (t) => !KNOWN_FIELD_TYPES.includes(t as (typeof KNOWN_FIELD_TYPES)[number]),
        {
          message: 'Type must be an unknown field type (not a recognized field type)',
        }
      )
    )
  ),
})

/** @public */
export type UnknownField = Schema.Schema.Type<typeof UnknownFieldSchema>
