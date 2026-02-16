/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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

/**
 * Validate a column name to prevent SQL injection
 */
export const validateColumnName = (columnName: string): void => {
  const validIdentifier = /^[a-z_][a-z0-9_]*$/i
  if (!validIdentifier.test(columnName) || columnName.length > 63) {
    // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for invalid input
    throw new Error(`Invalid column name: ${columnName}`)
  }
}
