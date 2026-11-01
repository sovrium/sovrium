/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a table's definition changed since the previous migration, and
 * whether that change must be reconciled against the live database: the
 * previous-snapshot lookups, the whole-table comparison, the DDL fingerprint
 * and the formula-column reshape checks.
 *
 * Split out of `migration-statements.ts`, which keeps the ALTER generation.
 */

import { isPhysicalColumnField } from '../sql/sql-field-predicates'
import { generateColumnDefinition } from '../sql/sql-generators'
import { generateCreateTableSQL, type TableDdlInputs } from '../table-operations/create-table-sql'
import { findDriftedFormulaColumns } from './type-utils'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/** Which intrinsic timestamp columns are absent from both the schema and the live table. */
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
export const findPreviousTable = (
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
 * The previous definition of a table renamed under its id: the snapshot entry
 * with the same `id` whose name the config no longer declares. The rename step
 * has already moved the relation to the new name, so the comparison reads that
 * entry under the new name — a rename alone is not a definition change, and
 * must not rebuild the table and copy its rows.
 */
const findRenamedPreviousTable = (
  table: Table,
  declared: ReadonlyMap<string, unknown>,
  previousSchema?: { readonly tables: readonly object[] }
): object | undefined => {
  const previous = previousSchema?.tables.find((t) => {
    if (typeof t !== 'object' || t === null) return false
    const entry = t as { readonly id?: unknown; readonly name?: unknown }
    return (
      entry.id !== undefined &&
      String(entry.id) === String(table.id) &&
      typeof entry.name === 'string' &&
      !declared.has(entry.name)
    )
  })
  return previous === undefined ? undefined : { ...previous, name: table.name }
}

/** A formula column's definition, or `undefined` when a stored snapshot cannot render it. */
const formulaColumnDefinition = (
  field: Fields[number],
  fields: readonly Fields[number][],
  dialect: DatabaseDialect
): string | undefined => {
  try {
    return generateColumnDefinition(field, { dialect, allFields: fields })
  } catch {
    return undefined
  }
}

/**
 * Whether a formula column already in the table changes shape: it moves
 * between a generated column and a plain one a trigger fills, or its generated
 * expression changes. Neither is an `ALTER` the engine emits — a generated
 * column's expression is fixed, and a trigger cannot write one — so the table
 * is rebuilt from the current definition, its rows copied and its trigger
 * formulas computed again. Left alone, the column kept its old expression, and
 * a write to the table failed once a trigger tried to fill it.
 */
export const formulaColumnsReshaped = (
  table: Table,
  previousTable: object | undefined,
  dialect: DatabaseDialect
): boolean => {
  const previousFields = (previousTable as { readonly fields?: unknown } | undefined)?.fields
  if (!Array.isArray(previousFields)) return false
  const before = previousFields as readonly Fields[number][]
  return table.fields.some((field) => {
    if (field.type !== 'formula' || !isPhysicalColumnField(field, table.fields)) return false
    const previous = before.find((candidate) => candidate.name === field.name)
    if (previous?.type !== 'formula') return false
    const now = formulaColumnDefinition(field, table.fields, dialect)
    const then = formulaColumnDefinition(previous, before, dialect)
    if (now === undefined || then === undefined || now === then) return false
    return now.includes('GENERATED ALWAYS') || then.includes('GENERATED ALWAYS')
  })
}

/**
 * Whether a formula column of the live table is not of the type this version
 * declares (see {@link findDriftedFormulaColumns}). PostgreSQL only.
 */
export const hasDriftedFormulaColumns = (
  table: Table,
  existingColumns: ReadonlyMap<string, { readonly dataType: string }>,
  dialect: DatabaseDialect
): boolean =>
  dialect !== 'sqlite' &&
  findDriftedFormulaColumns(
    table.fields,
    new Map([...existingColumns].map(([name, column]) => [name, column.dataType]))
  ).length > 0

/**
 * Whether the table's formula columns force a rebuild: one changed shape since
 * the previous migration ({@link formulaColumnsReshaped}), or one is of a type
 * an earlier version converted it to ({@link hasDriftedFormulaColumns}).
 */
export const formulaColumnsNeedRebuild = (
  table: Table,
  existingColumns: ReadonlyMap<string, { readonly dataType: string }>,
  previousTable: object | undefined,
  dialect: DatabaseDialect
): boolean =>
  formulaColumnsReshaped(table, previousTable, dialect) ||
  hasDriftedFormulaColumns(table, existingColumns, dialect)

/**
 * The previous definition of `table`: the snapshot entry of the same name, or
 * — for a table renamed under its id — the entry under its former name, read
 * under the new name. `declared` is keyed by every table the config declares.
 */
export const findPreviousTableDefinition = (
  table: Table,
  declared: ReadonlyMap<string, unknown>,
  previousSchema?: { readonly tables: readonly object[] }
): object | undefined =>
  findPreviousTable(table.name, previousSchema) ??
  findRenamedPreviousTable(table, declared, previousSchema)

/**
 * Whether this table's definition is byte-identical to its definition in the
 * previously-migrated schema snapshot.
 *
 * When true, the table needs no reconciliation at all: incremental ALTERs are
 * empty AND no constraint/config differs from the last run, so the migrate path
 * can skip it entirely (the idempotent schema re-initialisation rule fix #1) instead of needlessly recreating it.
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
const tableDdlFingerprint = (table: object, options: TableDdlInputs): string | undefined => {
  try {
    return generateCreateTableSQL(table as Table, options)
  } catch {
    return undefined
  }
}

/**
 * Whether a changed table definition must be reconciled against the live
 * database — i.e. whether the change actually reaches the DDL.
 *
 * The engine never emits `ALTER COLUMN` on SQLite (see
 * `generateColumnReshapeStatements` (`migration-statements.ts`) for why it is a deliberate choice
 * rather than a missing feature), so a change that yields no incremental ALTERs
 * is reconciled by a full recreate (create temp, copy, DROP, rename). That recreate
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
export const needsDefinitionReconciliation = (options: {
  readonly dialect: DatabaseDialect
  readonly table: Table
  readonly previousSchema?: { readonly tables: readonly object[] }
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  readonly hasAuthConfig?: boolean
}): boolean => {
  const { table, previousSchema, tableUsesView, tablePrimaryKeyTypes, hasAuthConfig } = options
  const ddlOptions: TableDdlInputs = {
    dialect: options.dialect,
    tablePrimaryKeyTypes,
    tableUsesView,
    ...(hasAuthConfig === undefined ? {} : { hasAuthConfig }),
  }
  if (isTableDefinitionUnchanged(table, previousSchema)) return false
  const previousTable = findPreviousTableDefinition(table, tablePrimaryKeyTypes, previousSchema)
  if (!previousTable) return true
  // Both sides are fingerprinted with the SAME map and auth flag: the question
  // is whether the two DEFINITIONS differ, so any input that is not part of the
  // definition must be held constant across the pair or it would manufacture a
  // difference of its own.
  const previousDdl = tableDdlFingerprint(previousTable, ddlOptions)
  const currentDdl = tableDdlFingerprint(table, ddlOptions)
  if (previousDdl === undefined || currentDdl === undefined) return true
  return previousDdl !== currentDdl
}
