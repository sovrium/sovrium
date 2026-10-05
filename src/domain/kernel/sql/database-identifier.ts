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

/**
 * The whole shape of a table name, read on the name AS WRITTEN: optional plain
 * spaces, a letter, then letters, digits, underscores, hyphens and plain spaces.
 * Only U+0020 counts as a space. The filter below applies it and words the
 * refusal; the same source is published as the JSON Schema `pattern`, so an
 * editor completing against `schemas/app.json` flags a tab or a line break the
 * way `sovrium validate` does.
 */
const TABLE_NAME_PATTERN = /^ *[a-zA-Z][a-zA-Z0-9_ -]*$/

/** Table names: user-friendly format, sanitized for the database downstream. */
const tableIdentifierSchema = (description: string | undefined) =>
  annotatedString(description).pipe(
    Schema.check(
      Schema.isMinLength(1, { message: 'This field is required' }),
      Schema.isMaxLength(63, { message: 'Maximum length is 63 characters' })
    ),
    Schema.check(
      Schema.makeFilter(
        (name) => {
          // Only a PLAIN space (U+0020) separates words or pads the ends. `\s`
          // once stood here and let a newline, a tab, a carriage return or a
          // non-breaking space through — each then reached every log and prompt
          // that names the table. The name is printed with `JSON.stringify` so a
          // control character in a refused name cannot break the report's line.
          const shown = JSON.stringify(name)
          if (/^ *\d/.test(name)) {
            return `Invalid table name ${shown}: name must start with a letter`
          }
          if (!TABLE_NAME_PATTERN.test(name)) {
            return `Invalid table name ${shown}: name must start with a letter and contain only letters, numbers, underscores, hyphens, or plain spaces (a tab, a line break or any other whitespace is refused)`
          }
          return true
        },
        { toJsonSchema: () => ({ pattern: TABLE_NAME_PATTERN.source }) }
      )
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
          `Table name ${JSON.stringify(name)} resolves to reserved SQL keyword '${sanitized}'. Reserved keywords like SELECT, INSERT, UPDATE, DELETE, etc. are restricted to prevent SQL syntax conflicts. Choose a different name.`
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
