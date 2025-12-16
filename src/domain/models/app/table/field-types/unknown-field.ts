/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

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
  type: Schema.String, // Accept any string as type
})

export type UnknownField = Schema.Schema.Type<typeof UnknownFieldSchema>
