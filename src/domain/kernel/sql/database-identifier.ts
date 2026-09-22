/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
 * Annotations carrying the caller's description, or nothing when it omitted one.
 *
 * The description has to be threaded INTO the refinement chain rather than
 * annotated onto the finished schema. Effect's JSON Schema generator drops a
 * `Schema.annotations({ description })` piped AFTER a refinement, and
 * `Schema.pattern` supplies a description of its own that outranks one placed on
 * the base string. Left alone, an option documented by its caller renders in
 * `apps/website/public/schema/app.json` — the snapshot served to config authors
 * for editor autocompletion — as the generated text "a string matching the
 * pattern ^[a-z][a-z0-9_]*$", which states the rule but not what the option is
 * FOR. So it rides on the base string (which the table branch reads) and on the
 * pattern options (which the field/column branch reads).
 */
const describeWith = (description: string | undefined) =>
  description === undefined ? {} : { description }

/** Base string carrying the caller's description, for branches without a pattern. */
const annotatedString = (description: string | undefined) =>
  description === undefined ? Schema.String : Schema.String.pipe(Schema.annotate({ description }))

/** Table names: user-friendly format, sanitized for the database downstream. */
const tableIdentifierSchema = (description: string | undefined) =>
  annotatedString(description).pipe(
    Schema.check(
      Schema.isMinLength(1, { message: 'This field is required' }),
      Schema.isMaxLength(63, { message: 'Maximum length is 63 characters' })
    ),
    Schema.check(
      Schema.makeFilter((name) => {
        const trimmed = name.trim()
        if (/^\d/.test(trimmed)) {
          return `Invalid table name '${name}': name must start with a letter`
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_\s-]*$/.test(trimmed)) {
          return `Invalid table name '${name}': name must start with a letter and contain only letters, numbers, underscores, hyphens, or spaces`
        }
        return true
      })
    ),
    Schema.check(
      Schema.makeFilter((name) => {
        const sanitized = name
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '')
        const isReserved = SQL_RESERVED_KEYWORDS.has(sanitized)
        return (
          !isReserved ||
          `Table name '${name}' resolves to reserved SQL keyword '${sanitized}'. Reserved keywords like SELECT, INSERT, UPDATE, DELETE, etc. are restricted to prevent SQL syntax conflicts. Choose a different name.`
        )
      })
    )
  )

/** Field / column names: strict database pattern. */
const columnIdentifierSchema = (identifierType: 'field' | 'column', description?: string) =>
  annotatedString(description).pipe(
    Schema.check(
      Schema.isMinLength(1, { message: 'This field is required' }),
      Schema.isMaxLength(63, { message: 'Maximum length is 63 characters' }),
      Schema.isPattern(/^[a-z][a-z0-9_]*$/, {
        ...describeWith(description),
        message: `Invalid ${identifierType} name pattern. Must follow database naming conventions: start with a letter, contain only lowercase letters, numbers, and underscores, maximum 63 characters (PostgreSQL limit). This name is used in SQL queries, API endpoints, and code generation. Choose descriptive names that clearly indicate the purpose (e.g., "email_address" not "ea").`,
      })
    ),
    Schema.check(
      Schema.makeFilter((name) => {
        const isReserved = SQL_RESERVED_KEYWORDS.has(name.toLowerCase())
        return (
          !isReserved ||
          `Cannot use reserved SQL keyword '${name}' as ${identifierType} name. Reserved keywords like SELECT, INSERT, UPDATE, DELETE, etc. are restricted to prevent SQL syntax conflicts. Choose a descriptive alternative name (e.g., 'user_record' instead of 'user', 'selection' instead of 'select').`
        )
      })
    )
  )

/**
 * Database Identifier Validation (Strict - for field names and column names)
 *
 * Shared validation schema for PostgreSQL identifiers (column names, field names, etc.)
 * Must follow database naming conventions: start with a letter, contain only lowercase
 * letters, numbers, and underscores, maximum 63 characters (PostgreSQL limit).
 *
 * This schema is used for field names and column names which must be strict.
 *
 * `description`, when supplied, documents the OPTION carrying this identifier
 * (e.g. a relationship's `foreignKey`) in the published JSON Schema — see
 * {@link describeWith} for why it cannot simply be annotated on the result.
 *
 * @example
 * ```typescript
 * 'users'
 * 'email_address'
 * 'created_at'
 * ```
 */
export const createDatabaseIdentifierSchema = (
  identifierType: 'table' | 'field' | 'column',
  description?: string
) =>
  identifierType === 'table'
    ? tableIdentifierSchema(description)
    : columnIdentifierSchema(identifierType, description)
