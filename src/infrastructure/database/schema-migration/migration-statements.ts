/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  generateCreatedAtColumn,
  generateDeletedAtColumn,
  generateUpdatedAtColumn,
} from '../table-operations/column-generators'
import { generateCreateTableSQL } from '../table-operations/create-table-sql'
import {
  needsIdColumnRecreation,
  findColumnsToAdd,
  findColumnsToDrop,
  findTypeChanges,
  findNullabilityChanges,
  findDefaultValueChanges,
  buildColumnStatements,
  type ExistingColumnInfo,
} from './column-detection'
import { detectAmbiguousFieldRenames, detectFieldRenames } from './rename-detection'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/** Which intrinsic timestamp columns are absent from both the schema and the live table. */
type MissingSpecialFields = {
  readonly created: boolean
  readonly updated: boolean
  readonly deleted: boolean
}

/**
 * SQLite arm of {@link generateSpecialFieldStatements}.
 *
 * Reuses the dialect-correct column-definition generators the fresh-CREATE path
 * uses (`TEXT NOT NULL DEFAULT (strftime(...))`), because SQLite has no `NOW()`
 * function and no `TIMESTAMPTZ` semantics — emitting the Postgres form would
 * crash schema-init on a pre-existing older-schema database that predates an
 * intrinsic timestamp column (e.g. `deleted_at` from soft-delete-by-default).
 */
const sqliteSpecialFieldStatements = (
  table: Table,
  missing: MissingSpecialFields
): readonly string[] => {
  const addColumns = (defs: readonly string[]): readonly string[] =>
    defs.map((def) => `ALTER TABLE ${table.name} ADD COLUMN ${def}`)
  return [
    ...(missing.created ? addColumns(generateCreatedAtColumn(table)) : []),
    ...(missing.updated ? addColumns(generateUpdatedAtColumn(table)) : []),
    ...(missing.deleted ? addColumns(generateDeletedAtColumn(table)) : []),
  ]
}

/**
 * Generate statements for automatic timestamp fields (created_at, updated_at, deleted_at)
 * when they are missing from an existing table.
 *
 * Dialect-aware: the Postgres arm is unchanged (byte-for-byte) —
 * `TIMESTAMPTZ NOT NULL DEFAULT NOW()`. The SQLite arm is delegated to
 * {@link sqliteSpecialFieldStatements}.
 */
const generateSpecialFieldStatements = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>
): readonly string[] => {
  const fieldNames = new Set(table.fields.map((f) => f.name))
  const missing: MissingSpecialFields = {
    created: !fieldNames.has('created_at') && !existingColumns.has('created_at'),
    updated: !fieldNames.has('updated_at') && !existingColumns.has('updated_at'),
    deleted: !fieldNames.has('deleted_at') && !existingColumns.has('deleted_at'),
  }

  if (isSqliteRuntime()) return sqliteSpecialFieldStatements(table, missing)

  return [
    ...(missing.created
      ? [`ALTER TABLE ${table.name} ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`]
      : []),
    ...(missing.updated
      ? [`ALTER TABLE ${table.name} ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`]
      : []),
    ...(missing.deleted ? [`ALTER TABLE ${table.name} ADD COLUMN deleted_at TIMESTAMPTZ`] : []),
  ]
}

/**
 * Refuse a migration whose field renames form a cycle — two fields of one table
 * exchanging names in a single edit.
 *
 * No evidence in the config can say which column each name belongs to, and both
 * available guesses relabel a populated column. Letting it through instead
 * surfaces the driver's own complaint about the half-applied rename colliding
 * with the column it is about to overwrite, which names one column, blames the
 * database, and gives the author nothing to act on.
 */
const validateFieldRenameAmbiguity = (
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): void => {
  const ambiguous = detectAmbiguousFieldRenames(table.name, table.fields, previousSchema)
  if (ambiguous.length > 0) {
    const fields = [...ambiguous].toSorted().join(', ')
    /* eslint-disable-next-line functional/no-throw-statements */
    throw new Error(
      `Ambiguous field rename detected in table '${table.name}': fields [${fields}] exchange ` +
        `names in a single config change, so Sovrium cannot tell which column each name should ` +
        `follow and refuses to guess. Rename them one at a time — deploy an intermediate name ` +
        `first, then the final one — or give the fields ids that stay attached to the same data.`
    )
  }
}

/** Validate destructive operations require explicit confirmation */
const validateDestructiveOps = (table: Table, columnsToDrop: readonly string[]): void => {
  if (columnsToDrop.length > 0 && !table.allowDestructive) {
    const droppedColumns = columnsToDrop.join(', ')
    /* eslint-disable-next-line functional/no-throw-statements */
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
 * Before [internal ref] both cases collapsed to an empty `generateAlterTableStatements`
 * result, so every unchanged table was needlessly dropped-and-recreated on each
 * version upgrade — fatally on Postgres, where the temp table re-created a
 * pre-existing named UNIQUE constraint.
 *
 * Currently the only incompatible change is an `id` column whose type is not the
 * required integer/serial primary key (see `needsIdColumnRecreation`). Dialect-
 * agnostic: the same decision holds on Postgres and SQLite.
 */
export const needsTableRecreation = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>
): boolean => {
  const { shouldProtectIdColumn } = computeIdProtection(table)
  return needsIdColumnRecreation(existingColumns, shouldProtectIdColumn)
}

/** Recursively sort object keys for order-independent structural comparison. */
const canonicalize = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  const record = value as Record<string, unknown>
  return Object.keys(record)
    .toSorted()
    .reduce<Record<string, unknown>>(
      (acc, key) => ({ ...acc, [key]: canonicalize(record[key]) }),
      {}
    )
}

/** The matching table in the previously-migrated schema snapshot, if any. */
const findPreviousTable = (
  tableName: string,
  previousSchema?: { readonly tables: readonly object[] }
): object | undefined =>
  previousSchema?.tables.find(
    (t) =>
      typeof t === 'object' &&
      t !== null &&
      'name' in t &&
      (t as { name?: unknown }).name === tableName
  )

/**
 * Whether this table's definition is byte-identical to its definition in the
 * previously-migrated schema snapshot.
 *
 * When true, the table needs no reconciliation at all: incremental ALTERs are
 * empty AND no constraint/config differs from the last run, so the migrate path
 * can skip it entirely ([internal ref] fix #1) instead of needlessly recreating it.
 * When the definition DID change but produced no column-level ALTERs (e.g. a
 * CHECK or UNIQUE constraint was added/removed), this returns false so the
 * caller still reconciles the table (via an idempotent recreate).
 *
 * Returns false when there is no previous snapshot or no matching previous table
 * (cannot prove "unchanged"). Comparison sorts keys to tolerate Postgres JSONB
 * property reordering of the stored snapshot.
 *
 * NOTE: this is a *whole-table* comparison, so it also reports "changed" for an
 * edit with no database consequence at all — a display-only field property such
 * as a currency `thousandsSeparator`. Callers deciding whether to RECREATE must
 * use {@link needsDefinitionReconciliation}, which additionally asks whether the
 * change reaches the DDL.
 */
export const isTableDefinitionUnchanged = (
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): boolean => {
  const previousTable = findPreviousTable(table.name, previousSchema)
  if (!previousTable) return false
  return JSON.stringify(canonicalize(table)) === JSON.stringify(canonicalize(previousTable))
}

/**
 * The CREATE TABLE DDL a table definition would produce, or `undefined` when it
 * cannot be generated.
 *
 * Generation is total for a valid `Table`, but the "previous" side comes from a
 * stored JSON snapshot written by an older binary, so it is only shaped like a
 * `Table`. A snapshot the current generator cannot render (e.g. a field type
 * since removed) yields `undefined`, which callers read as "cannot prove
 * equivalence" and fall back to reconciling.
 */
const tableDdlFingerprint = (
  table: object,
  tableUsesView?: ReadonlyMap<string, boolean>
): string | undefined => {
  try {
    return generateCreateTableSQL(table as Table, tableUsesView)
  } catch {
    return undefined
  }
}

/**
 * Whether a changed table definition must be reconciled against the live
 * database — i.e. whether the change actually reaches the DDL.
 *
 * SQLite has no `ALTER COLUMN`, so a change that yields no incremental ALTERs is
 * reconciled by a full recreate (create temp, copy, DROP, rename). That recreate
 * is destructive-in-passing: dropping a *referenced* parent table orphans its
 * children mid-transaction. So deciding to recreate on the strength of
 * {@link isTableDefinitionUnchanged} alone is wrong — that predicate compares the
 * WHOLE `Table`, so a purely cosmetic edit (adding a currency
 * `thousandsSeparator`, which only ever reaches `formatCurrencyValue`) reported
 * "changed", produced zero ALTERs, and fell through to a full recreate of a
 * table nothing asked to change.
 *
 * The test is derived rather than enumerated: instead of maintaining a list of
 * "display-only" properties across 40+ field types — unbounded, and guaranteed to
 * drift as properties are added — it asks whether the CREATE TABLE DDL differs.
 * `generateCreateTableSQL` embeds every structural fact a recreate exists to
 * reconcile (column set, types, nullability, defaults, plus the PK / UNIQUE /
 * CHECK / FK constraints from `generateTableConstraints`), so a property the
 * generator ignores has, by construction, nothing for a recreate to do. Indexes,
 * triggers and RLS are excluded on purpose: the caller syncs those
 * unconditionally, outside the recreate branch.
 *
 * Conservative in both directions that matter: with no previous snapshot, or when
 * either side's DDL cannot be generated, it returns `true` (reconcile) — exactly
 * the behaviour before this predicate existed.
 */
export const needsDefinitionReconciliation = (
  table: Table,
  previousSchema?: { readonly tables: readonly object[] },
  tableUsesView?: ReadonlyMap<string, boolean>
): boolean => {
  if (isTableDefinitionUnchanged(table, previousSchema)) return false
  const previousTable = findPreviousTable(table.name, previousSchema)
  if (!previousTable) return true
  const previousDdl = tableDdlFingerprint(previousTable, tableUsesView)
  const currentDdl = tableDdlFingerprint(table, tableUsesView)
  if (previousDdl === undefined || currentDdl === undefined) return true
  return previousDdl !== currentDdl
}

/** Generate ALTER TABLE statements for schema migrations */
export const generateAlterTableStatements = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] => {
  const { shouldProtectIdColumn, primaryKeyFields } = computeIdProtection(table)

  // A table needing full recreation yields no incremental ALTERs. The migrate
  // path decides recreate-vs-alter up front via `needsTableRecreation` and only
  // reaches here on the alter path; keep this guard so a direct caller still
  // gets [] rather than statements against a column about to be recreated.
  if (needsIdColumnRecreation(existingColumns, shouldProtectIdColumn)) return []

  validateFieldRenameAmbiguity(table, previousSchema)

  const fieldRenames = detectFieldRenames(table.name, table.fields, previousSchema)
  const renameStatements = Array.from(fieldRenames.entries()).map(
    ([oldName, newName]) => `ALTER TABLE ${table.name} RENAME COLUMN ${oldName} TO ${newName}`
  )

  const renamedOldNames = new Set(fieldRenames.keys())
  const renamedNewNames = new Set(fieldRenames.values())
  const schemaFieldsByName = new Map<string, Fields[number]>(
    table.fields.map((field) => [field.name, field])
  )

  const columnsToAdd = findColumnsToAdd(table, existingColumns, renamedNewNames)
  const columnsToDrop = findColumnsToDrop(
    existingColumns,
    schemaFieldsByName,
    shouldProtectIdColumn,
    renamedOldNames
  )

  validateDestructiveOps(table, columnsToDrop)

  const { dropStatements, addStatements } = buildColumnStatements({
    tableName: table.name,
    columnsToDrop,
    columnsToAdd,
    primaryKeyFields,
    allFields: table.fields,
  })

  // Per-column `ALTER COLUMN` reshaping (TYPE change, SET/DROP NOT NULL,
  // SET/DROP DEFAULT) is PostgreSQL-only — SQLite's `ALTER TABLE` has no
  // `ALTER COLUMN` clause at all, so these forms crash schema-init with
  // `near "ALTER": syntax error`. On SQLite these changes are reconciled by the
  // recreate-and-copy path instead: when a type/nullability/default change is
  // the *only* change to a table, this function returns no ALTER statements, so
  // `migrateExistingTableEffect` falls through to
  // `!isTableDefinitionUnchanged → recreateTableWithDataEffect`, which rebuilds
  // the table from the current schema (new column shapes inline) and copies the
  // data across. Renames / column adds / column drops remain expressible as
  // supported SQLite ALTERs and stay on both dialects.
  const columnReshapeStatements = isSqliteRuntime()
    ? []
    : [
        ...findTypeChanges(table, existingColumns, renamedNewNames),
        ...findDefaultValueChanges(table, existingColumns, renamedNewNames, previousSchema),
        ...findNullabilityChanges(table, existingColumns, renamedNewNames, primaryKeyFields),
      ]

  // ORDER: rename → drop → add → special fields → type changes → defaults → nullability
  return [
    ...renameStatements,
    ...dropStatements,
    ...addStatements,
    ...generateSpecialFieldStatements(table, existingColumns),
    ...columnReshapeStatements,
  ]
}
