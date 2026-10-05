/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { createDatabaseIdentifierSchema } from '@/domain/kernel/sql/database-identifier'

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
export const NameSchema = createDatabaseIdentifierSchema(
  'table',
  'Name of the table. It may contain capitals, hyphens and plain spaces; the database name is derived from it in lowercase with underscores, up to 63 characters.'
).pipe(
  Schema.annotate({
    title: 'Name',
    description:
      'User-friendly name for the table. Starts with a letter and may contain capitals, digits, underscores, hyphens and plain spaces; a tab, a line break or any other whitespace is refused. Will be automatically sanitized for database use (lowercase with underscores). Maximum 63 characters. Choose descriptive names that clearly indicate the purpose.',
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

/** @public */
export type Name = Schema.Schema.Type<typeof NameSchema>
