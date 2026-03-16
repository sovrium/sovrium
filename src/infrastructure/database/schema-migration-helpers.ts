/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema Migration Helpers - Re-export Module
 *
 * This file re-exports all schema migration utilities from the split module structure.
 * Maintained for backwards compatibility with existing imports.
 *
 * @see ./schema-migration/ for the actual implementations
 */

// Type exports
export type { BunSQLTransaction, ExistingColumnInfo } from './schema-migration'

// All function exports
export {
  // Constants
  PROTECTED_SYSTEM_TABLES,
  // Rename detection
  detectFieldRenames,
  detectTableRenames,
  // Table operations
  renameTablesIfNeeded,
  dropObsoleteTables,
  // Type utilities
  normalizeDataType,
  doesColumnTypeMatch,
  generateAlterColumnTypeStatement,
  // Column detection
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
  // Migration statement generation
  generateAlterTableStatements,
  // Constraint synchronization
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
  // Index synchronization
  syncIndexes,
} from './schema-migration'
