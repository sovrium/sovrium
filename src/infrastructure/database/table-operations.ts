/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createVolatileFormulaTriggers } from './formula-trigger-generators'
import { generateIndexStatements } from './index-generators'
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
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Check if field should create a database column
 * Some field types are UI-only and don't need database columns
 */
const shouldCreateDatabaseColumn = (field: Fields[number]): boolean => field.type !== 'button'

/**
 * Generate CREATE TABLE statement
 */
export const generateCreateTableSQL = (table: Table): string => {
  // Identify primary key fields
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Check if an 'id' field already exists in the fields array
  const hasIdField = table.fields.some((field) => field.name === 'id')

  // Check if a custom primary key is defined
  const hasCustomPrimaryKey = table.primaryKey && primaryKeyFields.length > 0

  // Add automatic id column only if not explicitly defined AND no custom primary key
  const idColumnDefinition = hasIdField || hasCustomPrimaryKey ? [] : ['id SERIAL NOT NULL']

  // Filter out UI-only fields (like button) that don't need database columns
  const columnDefinitions = table.fields.filter(shouldCreateDatabaseColumn).map((field) => {
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    return generateColumnDefinition(field, isPrimaryKey)
  })

  // Add PRIMARY KEY constraint on id if no custom primary key is defined
  const tableConstraints = generateTableConstraints(table)

  // If no explicit primary key is defined, add PRIMARY KEY on id
  const primaryKeyConstraint = !hasCustomPrimaryKey && !hasIdField ? ['PRIMARY KEY (id)'] : []

  const allDefinitions = [
    ...idColumnDefinition,
    ...columnDefinitions,
    ...tableConstraints,
    ...primaryKeyConstraint,
  ]

  return `CREATE TABLE IF NOT EXISTS ${table.name} (
  ${allDefinitions.join(',\n  ')}
)`
}

/**
 * Migrate existing table (ALTER statements + constraints + indexes)
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
export const migrateExistingTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table,
  existingColumns: ReadonlyMap<string, { dataType: string; isNullable: string }>
): Promise<void> => {
  const alterStatements = generateAlterTableStatements(table, existingColumns)

  // If alterStatements is empty, table has incompatible schema changes
  // (e.g., primary key type change) - drop and recreate
  if (alterStatements.length === 0) {
    await tx.unsafe(`DROP TABLE ${table.name} CASCADE`)
    const createTableSQL = generateCreateTableSQL(table)
    await tx.unsafe(createTableSQL)
  } else {
    // Apply incremental migrations
    for (const alterSQL of alterStatements) {
      await tx.unsafe(alterSQL)
    }
  }

  // Always add/update unique constraints for existing tables
  await syncUniqueConstraints(tx, table)

  // Always create indexes (IF NOT EXISTS prevents errors)
  for (const indexSQL of generateIndexStatements(table)) {
    await tx.unsafe(indexSQL)
  }

  // Always create/update triggers for created-at fields
  for (const triggerSQL of generateCreatedAtTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }

  // Always create/update triggers for autonumber fields
  for (const triggerSQL of generateAutonumberTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }

  // Always create/update triggers for updated-by fields
  for (const triggerSQL of generateUpdatedByTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }

  // Always create/update triggers for volatile formula fields
  await createVolatileFormulaTriggers(tx, table.name, table.fields)
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Create new table (CREATE statement + indexes + triggers)
 */
/* eslint-disable functional/no-expression-statements, functional/no-loop-statements */
export const createNewTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  table: Table
): Promise<void> => {
  const createTableSQL = generateCreateTableSQL(table)
  await tx.unsafe(createTableSQL)

  for (const indexSQL of generateIndexStatements(table)) {
    await tx.unsafe(indexSQL)
  }

  for (const triggerSQL of generateCreatedAtTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }

  for (const triggerSQL of generateAutonumberTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }

  for (const triggerSQL of generateUpdatedByTriggers(table)) {
    await tx.unsafe(triggerSQL)
  }

  // Create triggers for volatile formula fields
  await createVolatileFormulaTriggers(tx, table.name, table.fields)
}
/* eslint-enable functional/no-expression-statements, functional/no-loop-statements */

/**
 * Create or migrate table based on existence
 */
/* eslint-disable functional/no-expression-statements */
export const createOrMigrateTable = async (
  tx: BunSQLTransaction,
  table: Table,
  exists: boolean
): Promise<void> => {
  if (exists) {
    const existingColumns = await getExistingColumns(tx, table.name)
    await migrateExistingTable(tx, table, existingColumns)
  } else {
    await createNewTable(tx, table)
  }
}
/* eslint-enable functional/no-expression-statements */
