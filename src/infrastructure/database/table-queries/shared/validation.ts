/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const validateTableName = (tableName: string): void => {
  const validIdentifier = /^[a-z_][a-z0-9_]*$/i
  if (!validIdentifier.test(tableName) || tableName.length > 63) {
    throw new Error(`Invalid table name: ${tableName}`)
  }
}

export const validateColumnName = (columnName: string): void => {
  const validIdentifier = /^[a-z_][a-z0-9_]*$/i
  if (!validIdentifier.test(columnName) || columnName.length > 63) {
    throw new Error(`Invalid column name: ${columnName}`)
  }
}
