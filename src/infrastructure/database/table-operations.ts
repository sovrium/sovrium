/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Table Operations - Re-export Module
 *
 * This file re-exports all table operation utilities from the split module structure.
 * Maintained for backwards compatibility with existing imports.
 *
 * @see ./table-operations/ for the actual implementations
 */

// Type exports
export type { MigrationConfig } from './table-operations/'

// All function exports
export {
  // Type compatibility utilities
  normalizeType,
  areTypesCompatible,
  // Column generators
  generateIdColumn,
  needsAutomaticIdColumn,
  generateCreatedAtColumn,
  generateUpdatedAtColumn,
  generateDeletedAtColumn,
  generatePrimaryKeyConstraintIfNeeded,
  // CREATE TABLE SQL generation
  generateCreateTableSQL,
  // Table features (indexes, triggers, field permissions)
  applyTableFeatures,
  applyTableFeaturesWithoutIndexes,
  // Migration utilities
  getCompatibleColumns,
  copyDataAndResetSequences,
  recreateTableWithDataEffect,
  // Table effect operations
  migrateExistingTableEffect,
  createNewTableEffect,
  createLookupViewsEffect,
  createTableViewsEffect,
  createOrMigrateTableEffect,
} from './table-operations/'
