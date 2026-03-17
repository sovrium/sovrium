/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Table Operations Module
 *
 * This module provides utilities for database table operations:
 * - CREATE TABLE statement generation
 * - Table migration (ALTER TABLE, data preservation)
 * - Table feature application (indexes, triggers, RLS policies)
 * - Lookup VIEW creation
 * - User-defined VIEW creation
 *
 * All functions use Effect for type-safe error handling.
 */

// Type compatibility utilities
export { normalizeType, areTypesCompatible } from './type-compatibility'

// Column generators
export {
  generateIdColumn,
  needsAutomaticIdColumn,
  generateCreatedAtColumn,
  generateUpdatedAtColumn,
  generateDeletedAtColumn,
  generatePrimaryKeyConstraintIfNeeded,
} from './column-generators'

// CREATE TABLE SQL generation
export { generateCreateTableSQL } from './create-table-sql'

// Table features (indexes, triggers, RLS policies)
export { applyTableFeatures, applyTableFeaturesWithoutIndexes } from './table-features'

// Migration utilities
export {
  getCompatibleColumns,
  copyDataAndResetSequences,
  recreateTableWithDataEffect,
} from './migration-utils'

// Table effect operations
export type { MigrationConfig } from './table-effects'
export {
  migrateExistingTableEffect,
  createNewTableEffect,
  createLookupViewsEffect,
  createTableViewsEffect,
  createOrMigrateTableEffect,
} from './table-effects'
