/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Database Identifier Validation
 *
 * Shared validation schema for PostgreSQL identifiers (table names, column names, etc.)
 * Must follow database naming conventions: start with a letter, contain only lowercase
 * letters, numbers, and underscores, maximum 63 characters (PostgreSQL limit).
 *
 * This shared schema eliminates duplication between table name and field name validation.
 *
 * @example
 * ```typescript
 * 'users'
 * 'email_address'
 * 'created_at'
 * ```
 */
export const createDatabaseIdentifierSchema = (
  identifierType: 'table' | 'field' | 'column'
) =>
  Schema.String.pipe(
    Schema.minLength(1, { message: () => 'This field is required' }),
    Schema.maxLength(63, { message: () => 'Maximum length is 63 characters' }),
    Schema.pattern(/^[a-z][a-z0-9_]*$/, {
      message: () =>
        `Invalid ${identifierType} name pattern. Must follow database naming conventions: start with a letter, contain only lowercase letters, numbers, and underscores, maximum 63 characters (PostgreSQL limit). This name is used in SQL queries, API endpoints, and code generation. Choose descriptive names that clearly indicate the purpose (e.g., "email_address" not "ea").`,
    })
  )
