/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FieldNameSchema } from '@/domain/models/app/tables/fields/field-name'
import { FieldIdSchema } from '@/domain/types/branded-ids'

export const SearchWeightSchema = Schema.Literal('A', 'B', 'C', 'D').annotations({
  identifier: 'SearchWeight',
  title: 'Search Weight',
  description: 'PostgreSQL FTS weight for field relevance ranking: A (highest) to D (lowest)',
})

export const BaseFieldSchema = Schema.Struct({
  id: Schema.optional(FieldIdSchema),
  name: FieldNameSchema,
  required: Schema.optional(Schema.Boolean),
  unique: Schema.optional(Schema.Boolean),
  indexed: Schema.optional(Schema.Boolean),
  searchWeight: Schema.optional(
    SearchWeightSchema.annotations({
      description:
        'PostgreSQL FTS weight (A=highest, D=lowest). Only effective when indexed: true and searchEngine is fts or hybrid.',
    })
  ),
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

export type BaseField = Schema.Schema.Type<typeof BaseFieldSchema>
export type SearchWeight = Schema.Schema.Type<typeof SearchWeightSchema>
