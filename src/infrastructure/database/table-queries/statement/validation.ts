/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Validate a table name to prevent SQL injection
 *
 * PostgreSQL identifiers cannot be fully parameterized, so we validate them.
 * This function ensures table names:
 * - Only contain alphanumeric characters, underscores
 * - Start with a letter or underscore
 * - Are within PostgreSQL's 63-character limit
 *
 * @param tableName - Raw table name from user input
 * @throws Error if table name contains invalid characters
 */
export const validateTableName = (tableName: string): void => {
  // PostgreSQL identifier rules: start with letter/underscore, contain alphanumeric/underscore
  // Max 63 characters (PostgreSQL limit)
  const validIdentifier = /^[a-z_][a-z0-9_]*$/i
  if (!validIdentifier.test(tableName) || tableName.length > 63) {
    // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for invalid input
    throw new Error(`Invalid table name: ${tableName}`)
  }
}

/** PostgreSQL identifier shape: letter/underscore first, then alphanumerics. */
const VALID_COLUMN_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i

/**
 * Whether a column name is safe to interpolate into a raw SQL identifier.
 *
 * The non-throwing half of {@link validateColumnName}, for the callers that
 * have a fallback and so want a decision rather than an exception — the default
 * `ORDER BY` key resolver reads a name out of the app config and degrades to
 * `id` when it is unusable, where a throw would abort the whole read.
 *
 * Both spellings share ONE regex on purpose: a second copy of the rule is a
 * second thing to keep in step with the 63-character PostgreSQL limit.
 */
export const isValidColumnName = (columnName: string): boolean =>
  VALID_COLUMN_IDENTIFIER.test(columnName) && columnName.length <= 63

/**
 * Validate a column name to prevent SQL injection
 */
export const validateColumnName = (columnName: string): void => {
  if (!isValidColumnName(columnName)) {
    // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for invalid input
    throw new Error(`Invalid column name: ${columnName}`)
  }
}
