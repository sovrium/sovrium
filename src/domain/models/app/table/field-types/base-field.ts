/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FieldNameSchema } from '@/domain/models/app/table/field-name'
import { IdSchema } from '@/domain/models/app/table/id'

/**
 * Base Field Schema
 *
 * Common properties shared across all field types.
 * All field types should extend this base schema and add their specific properties.
 *
 * @example
 * ```typescript
 * export const CustomFieldSchema = BaseFieldSchema.pipe(
 *   Schema.extend(
 *     Schema.Struct({
 *       type: Schema.Literal('custom'),
 *       customProperty: Schema.String
 *     })
 *   )
 * )
 * ```
 */
export const BaseFieldSchema = Schema.Struct({
  id: IdSchema,
  name: FieldNameSchema,
  required: Schema.optional(Schema.Boolean),
  unique: Schema.optional(Schema.Boolean),
  indexed: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    description: 'Base field properties: id, name, required, unique, indexed',
  })
)

export type BaseField = Schema.Schema.Type<typeof BaseFieldSchema>
