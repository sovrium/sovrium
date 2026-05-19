/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type { MigrationConfig } from '../table-operations'

export {
  normalizeType,
  areTypesCompatible,
  generateIdColumn,
  needsAutomaticIdColumn,
  generateCreatedAtColumn,
  generateUpdatedAtColumn,
  generateDeletedAtColumn,
  generatePrimaryKeyConstraintIfNeeded,
  generateCreateTableSQL,
  applyTableFeatures,
  applyTableFeaturesWithoutIndexes,
  getCompatibleColumns,
  copyDataAndResetSequences,
  recreateTableWithDataEffect,
  migrateExistingTableEffect,
  createNewTableEffect,
  createLookupViewsEffect,
  createTableViewsEffect,
  createOrMigrateTableEffect,
} from '../table-operations'
