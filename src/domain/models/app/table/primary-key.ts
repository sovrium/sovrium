/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Primary Key
 *
 * Primary key configuration for the table. The primary key uniquely identifies each row and is automatically indexed.
 *
 * @example
 * ```typescript
 * {
 *   "type": "auto-increment",
 *   "field": "id"
 * }
 * ```
 */
export const PrimaryKeySchema = Schema.Struct({
  type: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description:
        "Primary key generation strategy. 'auto-increment' uses sequential integers (1, 2, 3...), 'uuid' generates random unique identifiers, 'composite' uses multiple fields together.",
    })
  ),
  field: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^[a-z][a-z0-9_]*$/, {
        message: () =>
          "Field name for single-column primary key. Only used with 'auto-increment' or 'uuid' type.",
      }),
      Schema.annotations({
        description:
          "Field name for single-column primary key. Only used with 'auto-increment' or 'uuid' type.",
        examples: ['id', 'user_id', 'product_id'],
      })
    )
  ),
  fields: Schema.optional(
    Schema.Array(
      Schema.String.pipe(Schema.minLength(1, { message: () => 'This field is required' }))
    ).pipe(Schema.annotations({ title: 'Primary Key Fields' }))
  ),
}).pipe(
  Schema.annotations({
    title: 'Primary Key',
    description:
      'Primary key configuration for the table. The primary key uniquely identifies each row and is automatically indexed.',
    examples: [
      { type: 'auto-increment', field: 'id' },
      { type: 'uuid', field: 'id' },
      { type: 'composite', fields: ['tenant_id', 'user_id'] },
    ],
  })
)

export type PrimaryKey = Schema.Schema.Type<typeof PrimaryKeySchema>
