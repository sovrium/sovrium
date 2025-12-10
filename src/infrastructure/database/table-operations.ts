/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateFieldPermissionGrants } from './field-permission-generators'
import { shouldCreateDatabaseColumn } from './field-utils'
import { createVolatileFormulaTriggers } from './formula-trigger-generators'
import { generateIndexStatements } from './index-generators'
import {
  shouldUseView,
  getBaseTableName,
  generateLookupViewSQL,
  generateLookupViewTriggers,
} from './lookup-view-generators'
import {
  generateRLSPolicyStatements,
  generateBasicTableGrants,
  generateAuthenticatedBasedGrants,
  generateRoleBasedGrants,
} from './rls-policy-generators'
import {
  getExistingColumns,
  generateAlterTableStatements,
  syncUniqueConstraints,
  type BunSQLTransaction,
} from './schema-migration-helpers'
import { generateColumnDefinition, generateTableConstraints } from './sql-generators'
import {
  generateCreatedAtTriggers,
  generateAutonumberTriggers,
  generateUpdatedByTriggers,
} from './trigger-generators'
import type { Table } from '@/domain/models/app/table'

/**
 * Generate automatic id column definition based on primary key type
 */
const generateIdColumn = (primaryKeyType: string | undefined): string => {
  if (primaryKeyType === 'uuid') {
    return 'id UUID NOT NULL DEFAULT gen_random_uuid()'
  }
  if (primaryKeyType === 'bigserial') {
    return 'id BIGSERIAL NOT NULL'
  }
  return 'id SERIAL NOT NULL'
}

/**
 * Determine if table needs an automatic id column
 */
const needsAutomaticIdColumn = (
  table: Table,
  primaryKeyFields: readonly string[]
): boolean => {
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const hasCustomPrimaryKey = primaryKeyFields.length > 0
  return !hasIdField && !hasCustomPrimaryKey
}

/**
 * Generate CREATE TABLE statement
 * When table has lookup fields, creates a base table (_base suffix) and will later create a VIEW
 */
export const generateCreateTableSQL = (
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): string => {
  // Determine table name (add _base suffix if using VIEW for lookup fields)
  const tableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

  // Identify primary key fields
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Generate automatic id column based on primary key type
  const idColumnDefinition = needsAutomaticIdColumn(table, primaryKeyFields)
    ? [generateIdColumn(table.primaryKey?.type)]
    : []

  // Filter out UI-only fields (like button) and lookup fields (handled by VIEW)
  // Lookup fields don't exist as columns in the base table
  const columnDefinitions = table.fields
    .filter((field) => shouldCreateDatabaseColumn(field) && field.type !== 'lookup')
    .map((field) => {
      const isPrimaryKey = primaryKeyFields.includes(field.name)
      return generateColumnDefinition(field, isPrimaryKey, table.fields)
    })

  // Add PRIMARY KEY constraint on id if no custom primary key is defined
  const tableConstraints = generateTableConstraints(table, tableUsesView)

  // If no explicit primary key is defined, add PRIMARY KEY on id
  const primaryKeyConstraint = needsAutomaticIdColumn(table, primaryKeyFields)
    ? ['PRIMARY KEY (id)']
    : []

  const allDefinitions = [
    ...idColumnDefinition,
    ...columnDefinitions,
    ...tableConstraints,
    ...primaryKeyConstraint,
  ]

  return `CREATE TABLE IF NOT EXISTS ${tableName} (
  ${allDefinitions.join(',\n  ')}
)`
}

/**
 * Execute SQL statements from a generator
 * Helper to eliminate duplication in index/trigger/policy creation
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
const executeSQLStatements = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  statements: readonly string[]
): Promise<void> => {
  for (const sql of statements) {
    await tx.unsafe(sql)
  }
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Apply table features (indexes, triggers, RLS policies, field permissions)
 * Shared by both createNewTable and migrateExistingTable
 * Note: Triggers and policies are applied to the base table, not the VIEW
 */
/* eslint-disable functional/no-expression-statements */
const applyTableFeatures = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  // Determine actual table name (base table if using VIEW)
  const physicalTableName = shouldUseView(table) ? getBaseTableName(table.name) : table.name

  // Create table object with physical table name for trigger/policy generation
  const physicalTable = shouldUseView(table)
    ? { ...table, name: physicalTableName }
    : table

  // Indexes (IF NOT EXISTS prevents errors)
  await executeSQLStatements(tx, generateIndexStatements(physicalTable))

  // Triggers for created-at fields
  await executeSQLStatements(tx, generateCreatedAtTriggers(physicalTable))

  // Triggers for autonumber fields
  await executeSQLStatements(tx, generateAutonumberTriggers(physicalTable))

  // Triggers for updated-by fields
  await executeSQLStatements(tx, generateUpdatedByTriggers(physicalTable))

  // Triggers for volatile formula fields
  await createVolatileFormulaTriggers(tx, physicalTableName, table.fields)

  // RLS policies for organization-scoped tables OR default deny when no permissions
  await executeSQLStatements(tx, generateRLSPolicyStatements(physicalTable))

  // Basic table grants for tables with no permissions (default deny)
  await executeSQLStatements(tx, generateBasicTableGrants(physicalTable))

  // Authenticated table grants for tables with authenticated permissions
  await executeSQLStatements(tx, generateAuthenticatedBasedGrants(physicalTable))

  // Role-based table grants for tables with role-based permissions
  await executeSQLStatements(tx, generateRoleBasedGrants(physicalTable))

  // Field-level permissions (column grants)
  await executeSQLStatements(tx, generateFieldPermissionGrants(physicalTable))
}
/* eslint-enable functional/no-expression-statements */

/**
 * Migrate existing table (ALTER statements + constraints + indexes)
 */
/* eslint-disable functional/no-expression-statements */
export const migrateExistingTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>,
  tableUsesView?: ReadonlyMap<string, boolean>
): Promise<void> => {
  const alterStatements = generateAlterTableStatements(table, existingColumns)

  // If alterStatements is empty, table has incompatible schema changes
  // (e.g., primary key type change) - drop and recreate
  if (alterStatements.length === 0) {
    await tx.unsafe(`DROP TABLE ${table.name} CASCADE`)
    const createTableSQL = generateCreateTableSQL(table, tableUsesView)
    await tx.unsafe(createTableSQL)
  } else {
    // Apply incremental migrations
    await executeSQLStatements(tx, alterStatements)
  }

  // Always add/update unique constraints for existing tables
  await syncUniqueConstraints(tx, table)

  // Apply all table features (indexes, triggers, RLS)
  await applyTableFeatures(tx, table)
}
/* eslint-enable functional/no-expression-statements */

/**
 * Create new table (CREATE statement + indexes + triggers)
 * Note: VIEWs are created in a separate phase after all base tables exist
 */
/* eslint-disable functional/no-expression-statements */
export const createNewTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): Promise<void> => {
  const createTableSQL = generateCreateTableSQL(table, tableUsesView)
  await tx.unsafe(createTableSQL)

  // Apply all table features (indexes, triggers, RLS)
  await applyTableFeatures(tx, table)
}
/* eslint-enable functional/no-expression-statements */

/**
 * Create lookup VIEWs for tables with lookup fields
 * Called after all base tables have been created to avoid dependency issues
 */
/* eslint-disable functional/no-expression-statements */
export const createLookupViews = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  if (shouldUseView(table)) {
    const createViewSQL = generateLookupViewSQL(table)
    if (createViewSQL) {
      await tx.unsafe(createViewSQL)

      // Create INSTEAD OF triggers to make the VIEW writable
      const triggerStatements = generateLookupViewTriggers(table)
      await executeSQLStatements(tx, triggerStatements)
    }
  }
}
/* eslint-enable functional/no-expression-statements */

/**
 * Create or migrate table based on existence
 */
/* eslint-disable functional/no-expression-statements */
export const createOrMigrateTable = async (
  tx: BunSQLTransaction,
  table: Table,
  exists: boolean,
  tableUsesView?: ReadonlyMap<string, boolean>
): Promise<void> => {
  if (exists) {
    const existingColumns = await getExistingColumns(tx, table.name)
    await migrateExistingTable(tx, table, existingColumns, tableUsesView)
  } else {
    await createNewTable(tx, table, tableUsesView)
  }
}
/* eslint-enable functional/no-expression-statements */
