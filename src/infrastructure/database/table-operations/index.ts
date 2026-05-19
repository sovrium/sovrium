/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export { normalizeType, areTypesCompatible } from './type-compatibility'

export {
  generateIdColumn,
  needsAutomaticIdColumn,
  generateCreatedAtColumn,
  generateUpdatedAtColumn,
  generateDeletedAtColumn,
  generatePrimaryKeyConstraintIfNeeded,
} from './column-generators'

export { generateCreateTableSQL } from './create-table-sql'

export { applyTableFeatures, applyTableFeaturesWithoutIndexes } from './table-features'

export {
  getCompatibleColumns,
  copyDataAndResetSequences,
  recreateTableWithDataEffect,
} from './migration-utils'

export type { MigrationConfig } from './table-effects'
export {
  migrateExistingTableEffect,
  createNewTableEffect,
  createLookupViewsEffect,
  createTableViewsEffect,
  createOrMigrateTableEffect,
} from './table-effects'
