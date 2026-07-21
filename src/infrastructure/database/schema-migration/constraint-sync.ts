/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  executeSQLStatements,
  type TransactionLike,
  type SQLExecutionError,
} from '../sql/sql-execution'
import { generateForeignKeyConstraints, generateTableConstraints } from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'


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
      }
    | undefined

  if (!previousTable) return []

  const previousUniqueFields =
    previousTable.fields?.filter((f) => f.name && 'unique' in f && f.unique).map((f) => f.name!) ??
    []

  const removedFields = previousUniqueFields.filter(
    (fieldName) => !currentUniqueFields.includes(fieldName)
  )

  return removedFields.map((fieldName) => {
    const constraintName = `${table.name}_${fieldName}_key`
    return `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${constraintName}`
  })
}

const buildUniqueConstraintAddStatements = (
  table: Table,
  uniqueFields: readonly string[]
): readonly string[] => {
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

  return singleFieldStatements
}

export const syncUniqueConstraints = (
  tx: TransactionLike,
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) return
    const uniqueFields = table.fields.filter((f) => 'unique' in f && f.unique).map((f) => f.name)
    const dropStatements = getUniqueConstraintDropStatements(table, previousSchema, uniqueFields)
    const addStatements = buildUniqueConstraintAddStatements(table, uniqueFields)

    yield* executeSQLStatements(tx, [...dropStatements, ...addStatements])
  })

export const syncForeignKeyConstraints = (
  tx: TransactionLike,
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) return
    const fkConstraints = generateForeignKeyConstraints(table.name, table.fields, tableUsesView)

    const statements = fkConstraints.flatMap((constraint) => {
      const match = constraint.match(/CONSTRAINT\s+\w+\s+FOREIGN KEY\s+\((\w+)\)/)
      if (!match) return []

      const columnName = match[1]

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

      const addStatement = `ALTER TABLE ${table.name} ADD ${constraint}`

      return [dropStatement, addStatement]
    })

    yield* executeSQLStatements(tx, statements)
  })

export const syncCheckConstraints = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (isSqliteRuntime()) return
    const allConstraints = generateTableConstraints(table, undefined)

    const checkConstraints = allConstraints.filter(
      (constraint) =>
        constraint.startsWith('CONSTRAINT') &&
        constraint.includes('CHECK') &&
        !constraint.includes('UNIQUE') &&
        !constraint.includes('FOREIGN KEY') &&
        !constraint.includes('PRIMARY KEY')
    )

    const statements = checkConstraints.flatMap((constraint) => {
      const match = constraint.match(/CONSTRAINT\s+(\w+)\s+CHECK/)
      if (!match) return []

      const constraintName = match[1]

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
        `ALTER TABLE ${table.name} ADD ${constraint} NOT VALID`,
      ]
    })

    yield* executeSQLStatements(tx, statements)
  })
