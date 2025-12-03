/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Unique Constraints
 *
 * Composite unique constraints ensure that combinations of multiple field values are unique across all rows. Use this when you need uniqueness across multiple fields (e.g., email + tenant_id must be unique together).
 *
 * @example
 * ```typescript
 * [
 *   {
 *     "name": "uq_user_email_tenant",
 *     "fields": [
 *       "email",
 *       "tenant_id"
 *     ]
 *   },
 *   {
 *     "name": "uq_product_sku_variant",
 *     "fields": [
 *       "sku",
 *       "variant_id"
 *     ]
 *   }
 * ]
 * ```
 */
export const UniqueConstraintsSchema = Schema.Array(
  Schema.Struct({
    name: Schema.String.pipe(
      Schema.minLength(1, { message: () => 'This field is required' }),
      Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
        message: () =>
          "Name of the unique constraint. Use descriptive names like 'uq_tablename_field1_field2'",
      }),
      Schema.transform(
        Schema.String,
        {
          decode: (name) => name.toLowerCase(),
          encode: (name) => name,
        }
      ),
      Schema.annotations({
        description:
          "Name of the unique constraint. Use descriptive names like 'uq_tablename_field1_field2'",
        examples: ['uq_users_email_tenant', 'uq_products_sku_variant', 'uq_orders_number_year'],
      })
    ),
    fields: Schema.Array(
      Schema.String.pipe(Schema.minLength(1, { message: () => 'This field is required' }))
    ).pipe(Schema.minItems(1, { message: () => 'At least one field is required' })),
  })
).pipe(
  Schema.annotations({
    title: 'Unique Constraints',
    description:
      'Composite unique constraints ensure that combinations of multiple field values are unique across all rows. Use this when you need uniqueness across multiple fields (e.g., email + tenant_id must be unique together).',
    examples: [
      [
        { name: 'uq_user_email_tenant', fields: ['email', 'tenant_id'] },
        { name: 'uq_product_sku_variant', fields: ['sku', 'variant_id'] },
      ],
    ],
  })
)

export type UniqueConstraints = Schema.Schema.Type<typeof UniqueConstraintsSchema>
