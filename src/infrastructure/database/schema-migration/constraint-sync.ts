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
import { isBtreeUniqueField } from '../sql/sql-key-constraints'
import type { Table } from '@/domain/models/app/tables'

/**
 * Dialect boundary for constraint reconciliation.
 * ------------------------------------------------
 * Every helper in this module reconciles a constraint on an ALREADY-EXISTING
 * table by emitting `ALTER TABLE … DROP/ADD CONSTRAINT` plus PL/pgSQL `DO $$`
 * catalog-probe blocks. That whole vocabulary is **PostgreSQL-only**: no SQLite
 * version has `DROP CONSTRAINT`, `ADD CONSTRAINT`, or procedural blocks, so
 * emitting these verbatim on SQLite crashes schema-init with
 * `SQLiteError: near "ALTER": syntax error`.
 *
 * This used to add that SQLite's `ALTER TABLE` "supports only RENAME / ADD
 * COLUMN / RENAME COLUMN / DROP COLUMN". That list is now version-dependent —
 * 3.53.2 also accepts `ALTER COLUMN … SET/DROP NOT NULL`, which 3.51.0 rejects
 * (measured 2026-09-20) — and the engine does not use the difference anyway. The
 * constraint vocabulary above is what is PostgreSQL-only here, and it is
 * unconditional; see `generateColumnReshapeStatements` in
 * `./migration-statements` for the column-reshape side and why it stays on the
 * recreate-and-copy path on every SQLite version.
 *
 * On SQLite, UNIQUE / FOREIGN KEY / CHECK constraints are declared INLINE in
 * `CREATE TABLE` (via `generateTableConstraints` / `generateForeignKeyConstraints`,
 * already exercised by the fresh-boot path and the recreate-and-copy path). So
 * constraint reconciliation is NOT a per-statement ALTER on SQLite — it is
 * carried by table (re)creation:
 *   - Fresh table  → `createNewTableEffect` emits the constraints inline.
 *   - Constraint-only change on an existing table → `migrateExistingTableEffect`
 *     detects it (`!isTableDefinitionUnchanged`, empty ALTER list) and runs the
 *     dialect-aware `recreateTableWithDataEffect`, which rebuilds the table with
 *     the current inline constraints and copies the data across.
 * Therefore the correct SQLite behavior for these three sync helpers is a
 * no-op: the constraints are always reconciled by (re)creation, never by ALTER.
 *
 * The PostgreSQL arms below are unchanged (byte-for-byte).
 */

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

  return removedFields.map((fieldName) => {
    const constraintName = `${table.name}_${fieldName}_key`
    return `ALTER TABLE ${table.name} DROP CONSTRAINT IF EXISTS ${constraintName}`
  })
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

  return singleFieldStatements
}

/**
 * Sync unique constraints for existing table
 * Adds named UNIQUE constraints for single-field constraints (fields with unique property)
 * Removes constraints that are no longer in the schema
 * Uses PostgreSQL default naming convention: {table}_{column}_key for single fields
 * Note: Composite uniqueness is handled via indexes with unique: true
 */
export const syncUniqueConstraints = (
  tx: TransactionLike,
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // SQLite: UNIQUE constraints are inline in CREATE TABLE; reconciled by
    // (re)creation, never by ALTER (see the module-level dialect note).
    if (isSqliteRuntime()) return
    // Must use the SAME predicate the CREATE path uses. Re-deriving this as a
    // bare `'unique' in f && f.unique` silently readmitted geolocation fields,
    // which CREATE excludes because Postgres `POINT` has no btree operator class
    // — so the ADD below failed on the second boot of an app that booted fine
    // the first time.
    const uniqueFields = table.fields.filter(isBtreeUniqueField).map((f) => f.name)
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
    // SQLite: FOREIGN KEY constraints are inline in CREATE TABLE; reconciled by
    // (re)creation, never by ALTER (see the module-level dialect note).
    if (isSqliteRuntime()) return
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
 * Sync CHECK constraints for existing table
 * Adds CHECK constraints for fields with validation requirements (enum values, ranges, formats, etc.)
 * Drops and recreates constraints when they are modified (e.g., min/max value changes)
 * This is needed when fields are added via ALTER TABLE and need their CHECK constraints
 *
 * LEGACY-DATA SAFETY (PostgreSQL): the constraint is (re-)added with `NOT VALID`.
 * ------------------------------------------------------------------------------
 * A plain `ALTER TABLE … ADD CONSTRAINT … CHECK (…)` IMMEDIATELY scans every
 * existing row and ABORTS the whole migration — crashing boot — if any legacy
 * row violates the (possibly tightened) predicate. That is exactly the reported
 * production crash: a pre-existing `single-select` row whose stored value is no
 * longer in the option set makes the re-added enum CHECK fail, and the boot dies
 * with a `SchemaInitializationError`.
 *
 * `NOT VALID` is the standard Postgres idiom for evolving a constraint on a
 * POPULATED table: the predicate is fully enforced on every INSERT/UPDATE from
 * now on (new and updated rows are still constrained), but pre-existing rows are
 * NOT scanned at add time — so boot never crashes on legacy data. Reconciling
 * old rows against a tightened constraint is an explicit operator action
 * (`ALTER TABLE … VALIDATE CONSTRAINT …`), never an implicit boot-time one.
 *
 * Because the add no longer scans existing rows, the previous pre-flight
 * `RAISE EXCEPTION … existing data violates check constraint …` probe (which was
 * itself the deliberate source of the boot crash) is removed: there is nothing
 * left to reject.
 *
 * We intentionally do NOT try to skip the drop/re-add when the constraint is
 * "unchanged". The only cross-version-robust equality test is a textual compare
 * against `pg_get_constraintdef`, whose normalized form (`= ANY (ARRAY[…])`,
 * per-column casts) diverges by PostgreSQL version and column type. A false
 * "unchanged" match would silently keep a STALE constraint after a genuine
 * option/range change — a worse failure than the (now non-crashing, `NOT VALID`)
 * re-add. The unconditional drop-then-re-add remains, only its add form changes.
 */
export const syncCheckConstraints = (
  tx: TransactionLike,
  table: Table
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    // SQLite: CHECK constraints are inline in CREATE TABLE; reconciled by
    // (re)creation, never by ALTER (see the module-level dialect note).
    if (isSqliteRuntime()) return
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

    // Build statements to drop existing constraints and re-add them as NOT VALID.
    // This keeps constraints up-to-date when validation rules change (e.g., an
    // option is added/removed or a max value increases) while never scanning —
    // and therefore never crashing on — pre-existing rows (see the legacy-data
    // note above).
    const statements = checkConstraints.flatMap((constraint) => {
      // Extract constraint name from the constraint SQL
      // Format: "CONSTRAINT {constraintName} CHECK ..."
      const match = constraint.match(/CONSTRAINT\s+(\w+)\s+CHECK/)
      if (!match) return []

      const constraintName = match[1]

      // Drop the existing constraint if present, then add the (possibly updated)
      // one as NOT VALID. NOT VALID enforces the predicate on all future writes
      // but skips validation of already-stored rows — so evolving a constraint
      // on a populated table can never abort boot on legacy-violating data.
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

    // Execute all statements sequentially (drop then add for each constraint)
    yield* executeSQLStatements(tx, statements)
  })
