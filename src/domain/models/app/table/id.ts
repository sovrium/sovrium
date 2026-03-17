/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Table ID
 *
 * Unique identifier for the table
 *
 * @example
 * ```typescript
 * 1
 * ```
 */
export const IdSchema = Schema.Int.pipe(
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(9_007_199_254_740_991),
  Schema.annotations({
    title: 'ID',
    description:
      'Unique positive integer identifier for entities. IDs are system-generated, auto-incrementing, and immutable. Must be unique within the parent collection (e.g., field IDs unique within a table, table IDs unique within the application). IDs are read-only and assigned automatically when entities are created. Range: 1 to 9,007,199,254,740,991 (JavaScript MAX_SAFE_INTEGER).',
    examples: [1, 2, 3, 100, 1000],
  })
)

export type Id = Schema.Schema.Type<typeof IdSchema>
