/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { translatableCollapseRefusal } from '@/domain/models/app/tables/translatable-field-service'
import {
  generateCreatedAtColumn,
  generateDeletedAtColumn,
  generateUpdatedAtColumn,
} from '../table-operations/column-generators'
import {
  needsIdColumnRecreation,
  findColumnsToAdd,
  findColumnsToDrop,
  findTypeChanges,
  findNullabilityChanges,
  findDefaultValueChanges,
  buildColumnStatements,
  type ColumnDrop,
  type ExistingColumnInfo,
} from './column-detection'
import { detectAmbiguousFieldRenames, detectFieldRenames } from './rename-detection'
import { findPreviousTable } from './table-definition-drift'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/** Which intrinsic timestamp columns are absent from both the schema and the live table. */
type MissingSpecialFields = {
  readonly created: boolean
  readonly updated: boolean
  readonly deleted: boolean
}

/**
 * SQLite arm of {@link generateSpecialFieldStatements}: the fresh-CREATE generators
 * (`TEXT NOT NULL DEFAULT (strftime(...))`), since SQLite has no `NOW()` or `TIMESTAMPTZ` —
 * the Postgres form crashed schema-init on a database predating an intrinsic timestamp column.
 */
const sqliteSpecialFieldStatements = (
  table: Table,
  missing: MissingSpecialFields,
  physicalTableName: string
): readonly string[] => {
  const addColumns = (defs: readonly string[]): readonly string[] =>
    defs.map((def) => `ALTER TABLE ${physicalTableName} ADD COLUMN ${def}`)
  return [
    ...(missing.created ? addColumns(generateCreatedAtColumn(table, 'sqlite')) : []),
    ...(missing.updated ? addColumns(generateUpdatedAtColumn(table, 'sqlite')) : []),
    ...(missing.deleted ? addColumns(generateDeletedAtColumn(table, 'sqlite')) : []),
  ]
}

/**
 * Statements adding the automatic timestamp columns (created_at, updated_at, deleted_at) an
 * existing table lacks: `TIMESTAMPTZ NOT NULL DEFAULT NOW()` on Postgres, else
 * {@link sqliteSpecialFieldStatements}.
 */
const generateSpecialFieldStatements = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  physicalTableName: string,
  dialect: DatabaseDialect
): readonly string[] => {
  const fieldNames = new Set(table.fields.map((f) => f.name))
  const missing: MissingSpecialFields = {
    created: !fieldNames.has('created_at') && !existingColumns.has('created_at'),
    updated: !fieldNames.has('updated_at') && !existingColumns.has('updated_at'),
    deleted: !fieldNames.has('deleted_at') && !existingColumns.has('deleted_at'),
  }

  if (dialect === 'sqlite') return sqliteSpecialFieldStatements(table, missing, physicalTableName)

  return [
    ...(missing.created
      ? [
          `ALTER TABLE ${physicalTableName} ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
        ]
      : []),
    ...(missing.updated
      ? [
          `ALTER TABLE ${physicalTableName} ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
        ]
      : []),
    ...(missing.deleted
      ? [`ALTER TABLE ${physicalTableName} ADD COLUMN deleted_at TIMESTAMPTZ`]
      : []),
  ]
}

/**
 * Refuse a migration whose field renames form a cycle — two fields of one table
 * exchanging names in a single edit. Nothing in the config says which column
 * each name belongs to, either guess relabels a populated column, and the
 * driver's own error on the half-applied rename gives the author nothing to act on.
 */
const validateFieldRenameAmbiguity = (
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): void => {
  const ambiguous = detectAmbiguousFieldRenames(table.name, table.fields, previousSchema)
  if (ambiguous.length > 0) {
    const fields = [...ambiguous].toSorted().join(', ')
    throw new Error(
      `Ambiguous field rename detected in table '${table.name}': fields [${fields}] exchange ` +
        `names in a single config change, so Sovrium cannot tell which column each name should ` +
        `follow and refuses to guess. Rename them one at a time — deploy an intermediate name ` +
        `first, then the final one — or give the fields ids that stay attached to the same data.`
    )
  }
}

/** Validate destructive operations (a column drop, a translatable collapse) require confirmation */
const validateDestructiveOps = (
  table: Table,
  columnsToDrop: readonly string[],
  previousSchema?: { readonly tables: readonly object[] }
): void => {
  const collapse = translatableCollapseRefusal(table, findPreviousTable(table.name, previousSchema))
  if (collapse !== undefined) throw new Error(collapse)
  if (columnsToDrop.length > 0 && !table.allowDestructive) {
    const droppedColumns = columnsToDrop.join(', ')
    throw new Error(
      `Destructive operation detected: Dropping column(s) [${droppedColumns}] from table '${table.name}' requires confirmation. Set allowDestructive: true to proceed with data loss, or keep the field(s) in the schema to preserve data.`
    )
  }
}

/**
 * Compute id-column protection state for a table: whether the automatic `id`
 * column must be preserved (no explicit `id` field and no custom primary key),
 * plus the composite primary-key field list. Both are reused across migration
 * statement generation and the recreate decision.
 */
const computeIdProtection = (
  table: Table
): { readonly shouldProtectIdColumn: boolean; readonly primaryKeyFields: readonly string[] } => {
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const shouldProtectIdColumn = !hasIdField && !(table.primaryKey && primaryKeyFields.length > 0)
  return { shouldProtectIdColumn, primaryKeyFields }
}

/**
 * Whether an existing table must be FULLY RECREATED (rather than incrementally
 * ALTERed) to reach the target schema.
 *
 * This is the explicit "incompatible change → recreate" signal the migrate path
 * threads to its call site, so a structurally-UNCHANGED table — which also
 * yields no ALTER statements — is NOT mistaken for one needing a recreate.
 * Before the idempotent schema re-initialisation rule both cases collapsed to an empty `generateAlterTableStatements`
 * result, so every unchanged table was needlessly dropped-and-recreated on each
 * version upgrade — fatally on Postgres, where the temp table re-created a
 * pre-existing named UNIQUE constraint.
 *
 * Currently the only incompatible change is an `id` column that disagrees with
 * the primary-key type the config DECLARES (see `needsIdColumnRecreation`) — the
 * declared type is the reference, NOT a fixed integer/serial. A table that asks
 * for `primaryKey: { type: 'text' }`, explicitly or implicitly via
 * `auth.scopeTables`, is already correct with a TEXT id and must not be
 * recreated. Dialect-agnostic: the same decision holds on Postgres and SQLite.
 */
export const needsTableRecreation = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  dialect: DatabaseDialect
): boolean => {
  const { shouldProtectIdColumn } = computeIdProtection(table)
  return needsIdColumnRecreation(
    existingColumns,
    shouldProtectIdColumn,
    table.primaryKey?.type,
    dialect
  )
}

/**
 * Per-column `ALTER COLUMN` reshaping (TYPE change, SET/DROP NOT NULL,
 * SET/DROP DEFAULT).
 *
 * PostgreSQL-only — and this is the ONE place the reason is written down, because
 * the obvious reason does not hold.
 *
 * NOT "SQLITE HAS NO `ALTER COLUMN`". Whether SQLite accepts an `ALTER COLUMN`
 * clause is version-dependent, so the engine cannot rely on either answer.
 * Measured:
 *
 *   - SQLite 3.51.0 — rejects every form with `near "ALTER": syntax error`.
 *     This is what a macOS host sees, because `bun:sqlite` links the SYSTEM
 *     library there.
 *   - SQLite 3.53.2 — ACCEPTS `ALTER COLUMN … SET NOT NULL` and `DROP NOT NULL`,
 *     and still rejects `SET DEFAULT` and `TYPE`. This is what Bun bundles on
 *     Linux, which is where the shipped binary and the container run.
 *
 * So the same statement succeeds or fails depending on the host the operator
 * deployed to, and it covers only nullability even where it works.
 *
 * WHY SQLITE ALWAYS RECREATES. Emitting `ALTER COLUMN` on SQLite would
 * buy a partial fast path for one of the three reshapes, on some hosts, while
 * recreate-and-copy still has to exist for the other two and for the hosts that
 * reject it. A reshape path that works on the maintainer's laptop and not on a
 * user's server — or the reverse — is worse than one that behaves identically
 * everywhere, so the engine deliberately never emits `ALTER COLUMN` on SQLite.
 * Do not "restore" it on the strength of a newer SQLite.
 *
 * On SQLite these changes are reconciled by the recreate-and-copy path instead:
 * when a type/nullability/default change is the *only* change to a table, this
 * returns nothing, so `migrateExistingTableEffect` falls through to
 * `needsDefinitionReconciliation → recreateTableWithDataEffect`, which rebuilds
 * the table from the current schema (new column shapes inline) and copies the
 * data across. Renames / column adds / column drops remain expressible as
 * supported SQLite ALTERs and stay on both dialects.
 */
const generateColumnReshapeStatements = (params: {
  readonly dialect: DatabaseDialect
  readonly table: Table
  readonly existingColumns: ReadonlyMap<string, ExistingColumnInfo>
  readonly fieldRenames: ReadonlyMap<string, string>
  readonly primaryKeyFields: readonly string[]
  readonly previousSchema?: { readonly tables: readonly object[] }
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  readonly physicalTableName: string
}): readonly string[] => {
  if (params.dialect === 'sqlite') return []
  const {
    table,
    existingColumns,
    fieldRenames,
    primaryKeyFields,
    previousSchema,
    tablePrimaryKeyTypes,
    physicalTableName,
  } = params
  const renamedNewNames = new Set(fieldRenames.values())
  // The type and nullability builders read `table.name` only to NAME the relation
  // they alter, so they get the physical name; the default-value builder keys the
  // previous-schema snapshot by the CONFIG name and takes the physical one apart.
  const physicalTable: Table = { ...table, name: physicalTableName }
  return [
    ...findTypeChanges(physicalTable, existingColumns, fieldRenames, tablePrimaryKeyTypes),
    ...findDefaultValueChanges(table, existingColumns, renamedNewNames, {
      previousSchema,
      physicalTableName,
    }),
    ...findNullabilityChanges(physicalTable, existingColumns, renamedNewNames, primaryKeyFields),
  ]
}

/**
 * Resolve which columns are renamed, added and dropped for one table. Renames
 * are resolved FIRST and their names excluded from the add/drop sets: a renamed
 * column must move, not be dropped and re-created empty.
 */
const planColumnChanges = (params: {
  readonly table: Table
  readonly existingColumns: ReadonlyMap<string, ExistingColumnInfo>
  readonly shouldProtectIdColumn: boolean
  readonly physicalTableName: string
  readonly previousSchema?: { readonly tables: readonly object[] }
}): {
  readonly renameStatements: readonly string[]
  readonly fieldRenames: ReadonlyMap<string, string>
  readonly columnsToAdd: readonly Fields[number][]
  readonly columnsToDrop: readonly string[]
} => {
  const { table, existingColumns, shouldProtectIdColumn, physicalTableName, previousSchema } =
    params
  const fieldRenames = detectFieldRenames(table.name, table.fields, previousSchema)
  const renamedNewNames = new Set(fieldRenames.values())
  const schemaFieldsByName = new Map<string, Fields[number]>(
    table.fields.map((field) => [field.name, field])
  )
  return {
    renameStatements: Array.from(fieldRenames.entries()).map(
      ([oldName, newName]) =>
        `ALTER TABLE ${physicalTableName} RENAME COLUMN ${quoteSqlIdentifier(oldName)} TO ${quoteSqlIdentifier(newName)}`
    ),
    fieldRenames,
    columnsToAdd: findColumnsToAdd(table, existingColumns, renamedNewNames),
    columnsToDrop: findColumnsToDrop(
      existingColumns,
      schemaFieldsByName,
      shouldProtectIdColumn,
      new Set(fieldRenames.keys())
    ),
  }
}

/**
 * Generate ALTER TABLE statements for schema migrations, and each `DROP COLUMN`
 * among them as its {@link ColumnDrop} (for a caller that may withhold one).
 *
 * @param physicalTableName - the relation the statements ALTER. Defaults to the
 *   config name; a view-backed table passes `<name>_base`, because its config
 *   name is a VIEW. The config name is still what every refusal message names
 *   and what the previous-schema snapshot is keyed by.
 * @param tablePrimaryKeyTypes - Map of table name → `primaryKey.type`. Required
 *   on any table carrying a `relationship` field: both the ADD COLUMN
 *   definition and the type-drift comparison must size the foreign key to the
 *   REFERENCED table's primary key, not to the hardcoded INTEGER mapping.
 */
export const generateAlterTableStatements = (options: {
  readonly dialect: DatabaseDialect
  readonly table: Table
  readonly existingColumns: ReadonlyMap<string, ExistingColumnInfo>
  readonly previousSchema?: { readonly tables: readonly object[] }
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  readonly hasAuthConfig?: boolean
  readonly physicalTableName?: string
}): { readonly statements: readonly string[]; readonly drops: readonly ColumnDrop[] } => {
  const { dialect, table, existingColumns, previousSchema, tablePrimaryKeyTypes, hasAuthConfig } =
    options
  const physicalTableName = options.physicalTableName ?? table.name
  const { shouldProtectIdColumn, primaryKeyFields } = computeIdProtection(table)

  // A table needing full recreation yields no ALTERs (the migrate path decides
  // that up front; this guard keeps a direct caller off a column being recreated).
  if (needsTableRecreation(table, existingColumns, dialect)) return { statements: [], drops: [] }
  validateFieldRenameAmbiguity(table, previousSchema)
  const { renameStatements, fieldRenames, columnsToAdd, columnsToDrop } = planColumnChanges({
    table,
    existingColumns,
    shouldProtectIdColumn,
    physicalTableName,
    previousSchema,
  })
  validateDestructiveOps(table, columnsToDrop, previousSchema)
  const { drops, dropStatements, addStatements } = buildColumnStatements({
    dialect,
    tableName: physicalTableName,
    columnsToDrop,
    columnsToAdd,
    primaryKeyFields,
    allFields: table.fields,
    tablePrimaryKeyTypes,
    ...(hasAuthConfig === undefined ? {} : { hasAuthConfig }),
  })

  const columnReshapeStatements = generateColumnReshapeStatements({
    ...options,
    fieldRenames,
    primaryKeyFields,
    physicalTableName,
  })

  // ORDER: rename → drop → add → special fields → type changes → defaults → nullability
  const statements = [
    ...renameStatements,
    ...dropStatements,
    ...addStatements,
    ...generateSpecialFieldStatements(table, existingColumns, physicalTableName, dialect),
    ...columnReshapeStatements,
  ]
  return { statements, drops }
}
