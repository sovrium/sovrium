/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { createDatabaseIdentifierSchema } from './database-identifier'

/**
 * Table Name
 *
 * Name of the database table
 *
 * @example
 * ```typescript
 * "users"
 * ```
 */
export const NameSchema = createDatabaseIdentifierSchema('table').pipe(
  Schema.annotations({
    title: 'Name',
    description:
      'Internal identifier name used for database tables, columns, and programmatic references. Must follow database naming conventions: start with a letter, contain only lowercase letters, numbers, and underscores, maximum 63 characters (PostgreSQL limit). This name is used in SQL queries, API endpoints, and code generation. Choose descriptive names that clearly indicate the purpose (e.g., "email_address" not "ea").',
    examples: [
      'person',
      'product',
      'invoice_item',
      'customer_email',
      'shipping_address',
      'created_at',
    ],
  })
)

export type Name = Schema.Schema.Type<typeof NameSchema>
