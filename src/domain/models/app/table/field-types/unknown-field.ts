/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Known field types that should NOT match UnknownFieldSchema
 */
const KNOWN_FIELD_TYPES = [
  'array',
  'autonumber',
  'barcode',
  'button',
  'checkbox',
  'color',
  'count',
  'created-at',
  'created-by',
  'currency',
  'date',
  'datetime',
  'decimal',
  'deleted-at',
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
 * Represents a field with an unrecognized type that passes schema validation
 * but will fail during SQL generation with "Unknown field type" error.
 *
 * This allows invalid field types to be caught during the migration phase
 * where PostgreSQL transaction rollback can properly handle the error,
 * rather than failing during schema validation before database operations begin.
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
    Schema.filter((t) => !KNOWN_FIELD_TYPES.includes(t as (typeof KNOWN_FIELD_TYPES)[number]), {
      message: () => 'Type must be an unknown field type (not a recognized field type)',
    })
  ),
})

export type UnknownField = Schema.Schema.Type<typeof UnknownFieldSchema>
