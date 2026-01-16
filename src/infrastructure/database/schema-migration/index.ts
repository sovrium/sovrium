/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema Migration Helpers
 *
 * This module provides utilities for database schema migrations:
 * - Table operations (rename, drop obsolete)
 * - Column detection (add, drop, modify)
 * - Type conversions and nullability changes
 * - Constraint synchronization (unique, foreign key, check)
 * - Index synchronization
 *
 * All functions use Effect for type-safe error handling.
 */

// Type exports
export type { ExistingColumnInfo } from './column-detection'
export { type TransactionLike as BunSQLTransaction } from '../sql-execution'

// Constants
export { PROTECTED_SYSTEM_TABLES } from './constants'

// Rename detection
export { detectFieldRenames, detectTableRenames } from './rename-detection'

// Table operations
export { renameTablesIfNeeded, dropObsoleteTables } from './table-operations'

// Type utilities
export {
  normalizeDataType,
  doesColumnTypeMatch,
  generateAlterColumnTypeStatement,
} from './type-utils'

// Column detection
export {
  needsIdColumnRecreation,
  findColumnsToAdd,
  findColumnsToDrop,
  filterModifiableFields,
  findTypeChanges,
  generateNotNullValidationQuery,
  generateBackfillQuery,
  findNullabilityChanges,
  findDefaultValueChanges,
  buildColumnStatements,
} from './column-detection'

// Migration statement generation
export { generateAlterTableStatements } from './migration-statements'

// Constraint synchronization
export {
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
} from './constraint-sync'

// Index synchronization
export { syncIndexes } from './index-sync'
