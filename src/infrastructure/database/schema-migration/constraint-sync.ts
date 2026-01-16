/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql-execution'
import type { Table } from '@/domain/models/app/table'

/**
 * Get drop statements for removed unique constraints
 */
const getUniqueConstraintDropStatements = (
  table: Table,
  previousSchema: { readonly tables: readonly object[] } | undefined,
  currentUniqueFields: readonly string[]
): readonly string[] => {
  if (!previousSchema) return []

  const previousTable = previousSchema.tables.find(
    (t: object) => 'name' in t && t.name === table.name
  ) as
    | {
        name: string
        fields?: readonly { name?: string; unique?: boolean }[]
        uniqueConstraints?: readonly { name: string }[]
      }
    | undefined

  if (!previousTable) return []

  // Single-field constraints that were removed
  const previousUniqueFields =
    previousTable.fields?.filter((f) => f.name && 'unique' in f && f.unique).map((f) => f.name!) ??
    []

  const removedFields = previousUniqueFields.filter(
    (fieldName) => !currentUniqueFields.includes(fieldName)
  )

  const singleFieldDrops = removedFields.map((fieldName) => {
    const constraintName = `${table.name}_${fieldName}_key`
    return `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${constraintName}`
  })

  // Composite constraints that were removed
  const previousCompositeNames = previousTable.uniqueConstraints?.map((c) => c.name) ?? []
  const currentCompositeNames = table.uniqueConstraints?.map((c) => c.name) ?? []

  const removedComposites = previousCompositeNames.filter(
    (name) => !currentCompositeNames.includes(name)
  )

  const compositeDrops = removedComposites.map(
    (constraintName) => `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${constraintName}`
  )

  return [...singleFieldDrops, ...compositeDrops]
}

/**
 * Build SQL statements to add unique constraints (single-field and composite)
 */
const buildUniqueConstraintAddStatements = (
  table: Table,
  uniqueFields: readonly string[]
): readonly string[] => {
  // Single-field constraints
  const singleFieldStatements = uniqueFields.map((fieldName) => {
    const constraintName = `${table.name}_${fieldName}_key`
    return `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = '${table.name}'
            AND constraint_type = 'UNIQUE'
            AND constraint_name = '${constraintName}'
        ) THEN
          ALTER TABLE ${table.name} ADD CONSTRAINT ${constraintName} UNIQUE (${fieldName});
        END IF;
      END$$;
    `
  })

  // Composite constraints
  const compositeStatements =
    table.uniqueConstraints?.map((constraint) => {
      const fields = constraint.fields.join(', ')
      return `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = '${table.name}'
              AND constraint_type = 'UNIQUE'
              AND constraint_name = '${constraint.name}'
          ) THEN
            ALTER TABLE ${table.name} ADD CONSTRAINT ${constraint.name} UNIQUE (${fields});
          END IF;
        END$$;
      `
    }) ?? []

  return [...singleFieldStatements, ...compositeStatements]
}

/**
 * Sync unique constraints for existing table
 * Adds named UNIQUE constraints for:
 * 1. Single-field constraints (fields with unique property)
 * 2. Composite unique constraints (table.uniqueConstraints)
 * Removes constraints that are no longer in the schema
 * Uses PostgreSQL default naming convention: {table}_{column}_key for single fields
 */
export const syncUniqueConstraints = (
  tx: TransactionLike,
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const uniqueFields = table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
    const dropStatements = getUniqueConstraintDropStatements(table, previousSchema, uniqueFields)
    const addStatements = buildUniqueConstraintAddStatements(table, uniqueFields)

    yield* executeSQLStatements(tx, [...dropStatements, ...addStatements])
  })

/**
 * Sync foreign key constraints for existing table
 * Drops and recreates FK constraints to ensure referential actions (ON DELETE, ON UPDATE) are up-to-date
 * This is needed when table schema is updated with new referential actions
 *
 * NOTE: After RENAME COLUMN, PostgreSQL preserves FK constraints but doesn't rename them.
 * We need to drop old constraints by column name, not just by expected constraint name.
 */
export const syncForeignKeyConstraints = (
  tx: TransactionLike,
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { generateForeignKeyConstraints } = yield* Effect.promise(
      () => import('../sql-generators')
    )
    const fkConstraints = generateForeignKeyConstraints(table.name, table.fields, tableUsesView)

    // Build drop and add statements for each FK constraint
    const statements = fkConstraints.flatMap((constraint) => {
      // Extract column name from the constraint SQL
      // Format: "CONSTRAINT {constraintName} FOREIGN KEY ({columnName}) REFERENCES ..."
      const match = constraint.match(/CONSTRAINT\s+\w+\s+FOREIGN KEY\s+\((\w+)\)/)
      if (!match) return []

      const columnName = match[1]

      // Drop ALL existing FK constraints on this column (handles renamed columns)
      // PostgreSQL doesn't rename constraints when column is renamed, so we need to drop by column
      const dropStatement = `
        DO $$
        DECLARE
          constraint_rec RECORD;
        BEGIN
          FOR constraint_rec IN
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = '${table.name}'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND kcu.column_name = '${columnName}'
          LOOP
            EXECUTE 'ALTER TABLE ${table.name} DROP CONSTRAINT ' || constraint_rec.constraint_name;
          END LOOP;
        END$$;
      `

      // Add constraint with updated referential actions
      const addStatement = `ALTER TABLE ${table.name} ADD ${constraint}`

      return [dropStatement, addStatement]
    })

    // Execute all FK constraint statements sequentially
    yield* executeSQLStatements(tx, statements)
  })

/**
 * Validate existing data against new CHECK constraint before applying
 * Returns validation query that will throw error if data violates constraint
 */
const generateConstraintValidationQuery = (
  tableName: string,
  constraint: string
): string | undefined => {
  // Extract constraint condition from the constraint SQL
  // Format: "CONSTRAINT {constraintName} CHECK ({condition})"
  const match = constraint.match(/CHECK\s*\((.+)\)$/)
  if (!match) return undefined

  const condition = match[1]

  // Generate query that will fail if any row violates the new constraint
  // Using NOT ({condition}) to find rows that violate the constraint
  return `
    DO $$
    DECLARE
      violation_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO violation_count
      FROM ${tableName}
      WHERE NOT (${condition});

      IF violation_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: existing data violates check constraint. % row(s) in table "${tableName}" violate the new constraint condition.', violation_count;
      END IF;
    END$$;
  `
}

/**
 * Sync CHECK constraints for existing table
 * Adds CHECK constraints for fields with validation requirements (enum values, ranges, formats, etc.)
 * Drops and recreates constraints when they are modified (e.g., min/max value changes)
 * This is needed when fields are added via ALTER TABLE and need their CHECK constraints
 *
 * CRITICAL: Validates existing data before applying new constraints
 * Migration will FAIL if any existing data violates the new constraint
 */
export const syncCheckConstraints = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const { generateTableConstraints } = yield* Effect.promise(() => import('../sql-generators'))
    const allConstraints = generateTableConstraints(table, undefined)

    // Filter only CHECK constraints (not UNIQUE, FK, or PRIMARY KEY)
    const checkConstraints = allConstraints.filter(
      (constraint) =>
        constraint.startsWith('CONSTRAINT') &&
        constraint.includes('CHECK') &&
        !constraint.includes('UNIQUE') &&
        !constraint.includes('FOREIGN KEY') &&
        !constraint.includes('PRIMARY KEY')
    )

    // Build statements to drop existing constraints and add new ones
    // This ensures constraints are updated when validation rules change (e.g., max value increases)
    const statements = checkConstraints.flatMap((constraint) => {
      // Extract constraint name from the constraint SQL
      // Format: "CONSTRAINT {constraintName} CHECK ..."
      const match = constraint.match(/CONSTRAINT\s+(\w+)\s+CHECK/)
      if (!match) return []

      const constraintName = match[1]

      // Generate validation query to check if existing data violates new constraint
      const validationQuery = generateConstraintValidationQuery(table.name, constraint)

      // Drop existing constraint if it exists, validate data, then add the new constraint
      // This handles both new constraints and modified constraints
      return [
        `
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE table_name = '${table.name}'
                AND constraint_type = 'CHECK'
                AND constraint_name = '${constraintName}'
            ) THEN
              ALTER TABLE ${table.name} DROP CONSTRAINT ${constraintName};
            END IF;
          END$$;
        `,
        ...(validationQuery ? [validationQuery] : []),
        `ALTER TABLE ${table.name} ADD ${constraint}`,
      ]
    })

    // Execute all statements sequentially (drop, validate, then add for each constraint)
    yield* executeSQLStatements(tx, statements)
  })
