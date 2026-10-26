/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turn parsed seed files into an ordered, fully-validated write plan — or into
 * the refusal that explains why no such plan exists.
 *
 * Planning is a pure function of (config, files, mode, `--table` filter, anchor
 * instant). Nothing here touches a database, a filesystem or a clock, which is
 * what lets `--dry-run` report exactly what a real run would do, and what lets
 * every refusal fire before a single row is written.
 *
 * ## Why the checks run in this order
 *
 * The order is not cosmetic — it decides which message an operator sees when a
 * data set is wrong in two ways at once. Structural problems (unknown table,
 * duplicate key, undeclared field) come first because they make everything
 * downstream meaningless. Merge-key resolution comes *before* the
 * many-to-many refusal because a table with neither a `mergeOn` nor a
 * many-to-many-free shape is failing at the merge key first: telling that
 * operator about link splitting would send them to fix the wrong thing.
 */

import { recordLanguageOrder } from '@/domain/models/app/tables/translatable-field-service'
import { collectSeedTableEdges, resolveSeedTableOrder, type SeedMode } from '@/domain/models/seed'
import {
  checkDuplicateKeys,
  checkReferenceTargets,
  checkRequestedTables,
  checkUndeclaredFields,
  checkUnknownTables,
  resolveMergeOn,
} from './seed-checks'
import { findSeedTable, manyToManyFieldNames, seedTablesOf } from './seed-config'
import { checkTranslatableValues, withLanguageMaps } from './seed-translatable'
import { planSeedValue } from './seed-values'
import type { LoadedSeedFile, PlannedSeedRecord, PlannedSeedTable } from './seed-checks'
import type { SeedTableConfig } from './seed-config'
import type { SeedValue } from './seed-values'
import type { App } from '@/domain/models/app'

export type { LoadedSeedFile, PlannedSeedTable } from './seed-checks'

/** A validated, dependency-ordered write plan. */
export interface SeedPlan {
  /** Every loaded table, in scope or not — out-of-scope keys stay resolvable. */
  readonly tables: readonly PlannedSeedTable[]
  /** In-scope table names, parent-first. */
  readonly order: readonly string[]
}

export type SeedPlanResult =
  | { readonly ok: true; readonly plan: SeedPlan }
  | { readonly ok: false; readonly errors: readonly string[] }

export interface BuildSeedPlanInput {
  readonly app: Readonly<App>
  readonly files: readonly LoadedSeedFile[]
  readonly mode: SeedMode
  /** `--table` values; empty means every seed file. */
  readonly requestedTables: readonly string[]
  /** The one instant every `{{today}}` in this run renders against. */
  readonly runAt: Readonly<Date>
  /**
   * The creation instant of a row whose file writes no `created_at` — the
   * pinned development clock — or `undefined` to leave it to the database.
   */
  readonly createdAt?: Readonly<Date> | undefined
}

/** Plan every value of one row, collecting the refusals rather than the first. */
const planRecordFields = (
  fields: Readonly<Record<string, unknown>>,
  runAt: Readonly<Date>
): {
  readonly planned: Readonly<Record<string, SeedValue>>
  readonly errors: readonly string[]
} => {
  const outcomes = Object.entries(fields).map(
    ([name, raw]) => [name, planSeedValue(raw, runAt)] as const
  )
  return {
    planned: Object.fromEntries(
      outcomes.flatMap(([name, outcome]) => (outcome.ok ? [[name, outcome.value]] : []))
    ),
    errors: outcomes.flatMap(([name, outcome]) =>
      outcome.ok ? [] : [`field "${name}": ${outcome.reason}`]
    ),
  }
}

/** Plan one file's rows, prefixing every refusal with the file and row key. */
const planRecords = (
  file: LoadedSeedFile,
  runAt: Readonly<Date>
): { readonly records: readonly PlannedSeedRecord[]; readonly errors: readonly string[] } => {
  const planned = file.records.map((record) => ({
    key: record.key,
    ...planRecordFields(record.fields, runAt),
  }))
  return {
    records: planned.map((entry) => ({ key: entry.key, fields: entry.planned })),
    errors: planned.flatMap((entry) =>
      entry.errors.map((error) => `${file.fileName} (key "${entry.key}"): ${error}`)
    ),
  }
}

/** Every `many-to-many` field this file's rows actually write to. */
const writtenManyToMany = (
  records: readonly PlannedSeedRecord[],
  table: SeedTableConfig | undefined
): readonly string[] => {
  if (!table) return []
  const written = new Set(records.flatMap((record) => Object.keys(record.fields)))
  return manyToManyFieldNames(table).filter((name) => written.has(name))
}

/** Structural refusals — everything that makes the rest of planning moot. */
const structuralErrors = (input: BuildSeedPlanInput, tables: readonly SeedTableConfig[]) => [
  ...checkUnknownTables(input.files, tables),
  ...checkRequestedTables(input.requestedTables, input.files),
  ...checkDuplicateKeys(input.files),
  ...checkUndeclaredFields(input.files, tables),
  ...checkTranslatableValues(input.files, tables, recordLanguageOrder(input.app.languages)),
]

/** Merge keys for the in-scope tables, or the refusals that block `upsert`. */
const resolveUpsertMergeKeys = (
  files: readonly LoadedSeedFile[],
  planned: readonly PlannedSeedTable[],
  tables: readonly SeedTableConfig[]
): {
  readonly byTable: ReadonlyMap<string, readonly string[]>
  readonly errors: readonly string[]
} => {
  const outcomes = planned
    .filter((table) => table.inScope)
    .flatMap((table) => {
      const file = files.find((candidate) => candidate.table === table.name)
      const config = findSeedTable(tables, table.name)
      if (!file || !config) return []
      return [[table.name, resolveMergeOn(file, config)] as const]
    })
  return {
    byTable: new Map(
      outcomes.flatMap(([name, outcome]) => (outcome.ok ? [[name, outcome.mergeOn]] : []))
    ),
    errors: outcomes.flatMap(([, outcome]) => (outcome.ok ? [] : [outcome.error])),
  }
}

/** Refusals that need the planned values: the rows each reference targets. */
const semanticErrors = (planned: readonly PlannedSeedTable[]): readonly string[] =>
  checkReferenceTargets(planned)

/**
 * The tables as far as ordering is concerned: a relationship field orders its
 * table after the one it points at only when a seed record writes it. The
 * reciprocal half of a two-sided link is written by nobody — its links are the
 * other half's junction rows — so counting it would close a cycle out of one
 * link and refuse a data set with a perfectly good write order.
 */
const withWrittenLinksOnly = (
  tables: readonly SeedTableConfig[],
  planned: readonly PlannedSeedTable[]
): readonly SeedTableConfig[] =>
  tables.map((table) => {
    const seeded = planned.find((one) => one.name === table.name)
    if (seeded === undefined) return table
    const written = new Set(seeded.records.flatMap((record) => Object.keys(record.fields)))
    return {
      ...table,
      fields: table.fields.filter(
        (field) => field.type !== 'relationship' || written.has(field.name)
      ),
    }
  })

/** The dependency order, or the cycle that makes one impossible. */
const orderScope = (
  scope: ReadonlySet<string>,
  tables: readonly SeedTableConfig[]
):
  | { readonly ok: true; readonly order: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] } => {
  const resolved = resolveSeedTableOrder([...scope], collectSeedTableEdges(tables, scope))
  if (resolved.ok) return { ok: true, order: resolved.order }
  return {
    ok: false,
    errors: [
      `Dependency cycle between seeded tables: ${resolved.cycle.join(' -> ')}` +
        (resolved.viaField ? ` (closed by field "${resolved.viaField}")` : '') +
        `. There is no order that writes every parent first, so sovrium seed refuses ` +
        `rather than inserting rows with dangling links.`,
    ],
  }
}

/** `records` with `createdAt` on every row whose file writes no `created_at`. */
const withCreationDate = (
  records: readonly PlannedSeedRecord[],
  createdAt: Readonly<Date> | undefined
): readonly PlannedSeedRecord[] =>
  createdAt === undefined
    ? records
    : records.map((record) =>
        Object.hasOwn(record.fields, 'created_at')
          ? record
          : {
              ...record,
              fields: {
                ...record.fields,
                created_at: { kind: 'literal', value: createdAt.toISOString() },
              },
            }
      )

/**
 * `records` with the `created_at` a row's file writes copied into every
 * `created-at` field of its table that the row leaves empty, so the field
 * reads the row's creation instant rather than the moment it was seeded. Like
 * `created_at`, the copy is written on insert only.
 */
const withCreatedAtFields = (
  records: readonly PlannedSeedRecord[],
  table: SeedTableConfig | undefined
): readonly PlannedSeedRecord[] => {
  const names = (table?.fields ?? [])
    .filter((field) => field.type === 'created-at' && field.name !== 'created_at')
    .map((field) => field.name)
  if (names.length === 0) return records
  return records.map((record) => {
    const created = record.fields['created_at']
    if (created === undefined) return record
    const missing = names.filter((name) => !Object.hasOwn(record.fields, name))
    return {
      ...record,
      fields: { ...record.fields, ...Object.fromEntries(missing.map((name) => [name, created])) },
    }
  })
}

/** Assemble one `PlannedSeedTable` from a planned file. */
const toPlannedTable = (
  entry: { readonly file: LoadedSeedFile; readonly records: readonly PlannedSeedRecord[] },
  tables: readonly SeedTableConfig[],
  scope: ReadonlySet<string>
): PlannedSeedTable => ({
  name: entry.file.table,
  fileName: entry.file.fileName,
  records: entry.records,
  mergeOn: [],
  manyToManyFields: writtenManyToMany(entry.records, findSeedTable(tables, entry.file.table)),
  inScope: scope.has(entry.file.table),
})

/**
 * Build the write plan, or return every refusal that applies at the first stage
 * where any applies.
 *
 * Stages fail closed and do not cascade: an operator fixing a duplicate key
 * should not have to re-run to discover a malformed token, but they also should
 * not be shown reference errors computed from rows that failed to plan.
 */
export const buildSeedPlan = (input: BuildSeedPlanInput): SeedPlanResult => {
  const tables = seedTablesOf(input.app)
  const structural = structuralErrors(input, tables)
  if (structural.length > 0) return { ok: false, errors: structural }

  const scope = new Set(
    input.requestedTables.length > 0 ? input.requestedTables : input.files.map((file) => file.table)
  )

  const planned = input.files.map((file) => ({ file, ...planRecords(file, input.runAt) }))
  const valueErrors = planned.flatMap((entry) => entry.errors)
  if (valueErrors.length > 0) return { ok: false, errors: valueErrors }

  const base = planned.map((entry) =>
    toPlannedTable(
      {
        ...entry,
        records: withCreationDate(
          withCreatedAtFields(
            withLanguageMaps(
              entry.records,
              findSeedTable(tables, entry.file.table),
              input.app.languages?.default
            ),
            findSeedTable(tables, entry.file.table)
          ),
          input.createdAt
        ),
      },
      tables,
      scope
    )
  )
  const mergeKeys =
    input.mode === 'upsert'
      ? resolveUpsertMergeKeys(input.files, base, tables)
      : { byTable: new Map<string, readonly string[]>(), errors: [] as readonly string[] }
  if (mergeKeys.errors.length > 0) return { ok: false, errors: mergeKeys.errors }

  const plannedTables = base.map((table) => ({
    ...table,
    mergeOn: mergeKeys.byTable.get(table.name) ?? [],
  }))
  const semantic = semanticErrors(plannedTables)
  if (semantic.length > 0) return { ok: false, errors: semantic }

  const ordered = orderScope(scope, withWrittenLinksOnly(tables, plannedTables))
  return ordered.ok
    ? { ok: true, plan: { tables: plannedTables, order: ordered.order } }
    : { ok: false, errors: ordered.errors }
}
