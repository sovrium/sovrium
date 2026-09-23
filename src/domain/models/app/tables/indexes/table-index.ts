/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * One index entry — named here so the manual can walk its options.
 *
 * `IndexesSchema` is the ARRAY, and an array root publishes no option table;
 * a directive has to name the element. Lifting it out of the `Schema.Array`
 * call changes nothing about what is decoded.
 */
export const TableIndexSchema = Schema.Struct({
  name: Schema.String.pipe(
    Schema.annotate({
      description: "Name of the index. Use descriptive names like 'idx_tablename_fieldname'",
      examples: ['idx_users_email', 'idx_products_sku', 'idx_orders_status'],
    }),
    Schema.check(
      Schema.isMinLength(1, { message: 'This field is required' }),
      Schema.isPattern(/^[a-z][a-z0-9_]*$/, {
        message: "Name of the index. Use descriptive names like 'idx_tablename_fieldname'",
      })
    )
  ),
  fields: Schema.Array(
    Schema.String.annotate({
      description: 'One field the index covers. Position matters — see the array description.',
    }).pipe(Schema.check(Schema.isMinLength(1, { message: 'This field is required' })))
  ).pipe(
    Schema.annotate({
      title: 'Index Fields',
      description:
        'Fields the index covers, in order. The order matters: an index on several fields also speeds up lookups on the first of them alone.',
    }),
    Schema.check(Schema.isMinLength(1, { message: 'At least one field is required' }))
  ),
  unique: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Refuses two records sharing the same combination of values across the indexed fields.',
    })
  ),
  where: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'WHERE clause for partial indexes. Creates an index that includes only rows satisfying the condition. Useful for enforcing uniqueness only on non-NULL values.',
        examples: ['username IS NOT NULL', "status = 'active'", 'deleted_at IS NULL'],
      }),
      Schema.check(Schema.isMinLength(1, { message: 'This field is required' }))
    )
  ),
}).pipe(Schema.annotate({ title: 'Index' }))

export const IndexesSchema = Schema.Array(TableIndexSchema)
  .annotate({
    // Before the checks — see the note in `agents/schedule.ts`.
    description:
      'Extra database indexes, each covering one or more fields, so filters and sorts on them stay fast as the table grows.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter((indexes) => {
        const names = indexes.map((index) => index.name)
        const uniqueNames = new Set(names)
        return names.length === uniqueNames.size || 'Index names must be unique within the table'
      })
    ),
    Schema.annotate({
      title: 'Database Indexes',
      description:
        'Custom database indexes for query optimization. Indexes improve query performance by creating efficient lookup structures for specified fields.',
      examples: [
        [
          { name: 'idx_user_email', fields: ['email'] },
          { name: 'idx_user_created', fields: ['created_at'], unique: false },
        ],
      ],
    })
  )

/** @public */
export type Indexes = Schema.Schema.Type<typeof IndexesSchema>
