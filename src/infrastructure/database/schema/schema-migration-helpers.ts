/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type { BunSQLTransaction, ExistingColumnInfo } from '../schema-migration'

export {
  PROTECTED_SYSTEM_TABLES,
  detectFieldRenames,
  detectTableRenames,
  renameTablesIfNeeded,
  dropObsoleteTables,
  normalizeDataType,
  doesColumnTypeMatch,
  generateAlterColumnTypeStatement,
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
  generateAlterTableStatements,
  syncUniqueConstraints,
  syncForeignKeyConstraints,
  syncCheckConstraints,
  syncIndexes,
} from '../schema-migration'
