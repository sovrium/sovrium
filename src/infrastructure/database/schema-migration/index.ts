/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type { ExistingColumnInfo } from './column-detection'
export { type TransactionLike as BunSQLTransaction } from '../sql/sql-execution'

export { PROTECTED_SYSTEM_TABLES } from './constants'

export { detectFieldRenames, detectTableRenames } from './rename-detection'

export { renameTablesIfNeeded, dropObsoleteTables } from './table-operations'

export {
  normalizeDataType,
  doesColumnTypeMatch,
  generateAlterColumnTypeStatement,
} from './type-utils'

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

export {
  generateAlterTableStatements,
  needsTableRecreation,
  isTableDefinitionUnchanged,
} from './migration-statements'

export {
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
} from './constraint-sync'

export { syncIndexes } from './index-sync'
