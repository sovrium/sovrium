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
      'User-friendly name for the table. Can contain spaces, mixed case, and special characters. Will be automatically sanitized for database use (lowercase with underscores). Maximum 63 characters. Choose descriptive names that clearly indicate the purpose.',
    examples: [
      'Person',
      'Product',
      'Invoice Item',
      'Customer Email',
      'Shipping Address',
      'My Projects',
    ],
  })
)

export type Name = Schema.Schema.Type<typeof NameSchema>
