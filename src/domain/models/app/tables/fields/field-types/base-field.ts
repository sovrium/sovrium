/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FieldNameSchema } from '@/domain/models/app/tables/fields/field-name'
import { FieldIdSchema } from '@/domain/types/branded-ids'

/**
 * PostgreSQL Full-Text Search weight for field relevance ranking.
 *
 * Maps directly to PostgreSQL FTS weights:
 * - `A`: Highest relevance (e.g., title, name)
 * - `B`: High relevance (e.g., description, summary)
 * - `C`: Medium relevance (e.g., tags, categories)
 * - `D`: Low relevance (e.g., internal notes, metadata)
 *
 * Only meaningful when `indexed: true` and a data source uses
 * `searchEngine: 'fts'` or `'hybrid'`.
 */
export const SearchWeightSchema = Schema.Literal('A', 'B', 'C', 'D').annotations({
  identifier: 'SearchWeight',
  title: 'Search Weight',
  description: 'PostgreSQL FTS weight for field relevance ranking: A (highest) to D (lowest)',
})

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
  id: Schema.optional(FieldIdSchema),
  name: FieldNameSchema,
  required: Schema.optional(Schema.Boolean),
  unique: Schema.optional(Schema.Boolean),
  indexed: Schema.optional(Schema.Boolean),
  /** PostgreSQL FTS weight for search relevance ranking */
  searchWeight: Schema.optional(
    SearchWeightSchema.annotations({
      description:
        'PostgreSQL FTS weight (A=highest, D=lowest). Only effective when indexed: true and searchEngine is fts or hybrid.',
    })
  ),
  /**
   * Storage configuration for the field value.
   *
   * Controls how the field data is stored in the database,
   * including compression settings for large text or attachment fields.
   */
  storage: Schema.optional(
    Schema.Struct({
      compression: Schema.optional(Schema.Boolean),
    }).pipe(
      Schema.annotations({
        description: 'Storage configuration (e.g., compression for large values)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Base Field',
    description:
      'Base field properties: id, name, required, unique, indexed, searchWeight, storage',
  })
)

/** @public */
export type BaseField = Schema.Schema.Type<typeof BaseFieldSchema>
/** @public */
export type SearchWeight = Schema.Schema.Type<typeof SearchWeightSchema>
