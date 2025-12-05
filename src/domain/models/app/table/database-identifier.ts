/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Reserved SQL keywords that cannot be used as table or column names
 * Based on PostgreSQL reserved keywords list
 * @see https://www.postgresql.org/docs/current/sql-keywords-appendix.html
 */
const SQL_RESERVED_KEYWORDS = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'from',
  'where',
  'join',
  'inner',
  'outer',
  'left',
  'right',
  'full',
  'cross',
  'on',
  'as',
  'table',
  'create',
  'alter',
  'drop',
  'truncate',
  'add',
  'column',
  'constraint',
  'primary',
  'foreign',
  'key',
  'references',
  'unique',
  'index',
  'view',
  'database',
  'schema',
  'grant',
  'revoke',
  'transaction',
  'commit',
  'rollback',
  'union',
  'intersect',
  'except',
  'group',
  'having',
  'order',
  'limit',
  'offset',
  'distinct',
  'all',
  'any',
  'some',
  'exists',
  'in',
  'between',
  'like',
  'ilike',
  'and',
  'or',
  'not',
  'null',
  'is',
  'true',
  'false',
  'case',
  'when',
  'then',
  'else',
  'end',
  'cast',
  'default',
  'check',
  'user',
  'current_user',
  'session_user',
  'current_date',
  'current_time',
  'current_timestamp',
])

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
    }),
    Schema.filter((name) => {
      const isReserved = SQL_RESERVED_KEYWORDS.has(name.toLowerCase())
      return (
        !isReserved ||
        `Cannot use reserved SQL keyword '${name}' as ${identifierType} name. Reserved keywords like SELECT, INSERT, UPDATE, DELETE, etc. are restricted to prevent SQL syntax conflicts. Choose a descriptive alternative name (e.g., 'user_record' instead of 'user', 'selection' instead of 'select').`
      )
    })
  )
