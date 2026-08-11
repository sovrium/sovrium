/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The refusal catalogue.
 *
 * Every function here answers the same question — "is there a reading of this
 * seed data that would produce a green run and wrong rows?" — and returns the
 * message that names the file, the row, and what was expected instead.
 *
 * Sovrium's dominant defect class is *well-formed, confident and wrong*, and
 * seeding is unusually exposed to it: the command runs unattended every night
 * on a host nobody is watching, its only signal is an exit code, and every
 * lenient alternative below (skip the unknown file, store the literal text,
 * pick an arbitrary order) exits `0`.
 */

import { ATTACHMENT_TYPES, findSeedTable, uniqueFieldNames } from './seed-config'
import { referencesOf } from './seed-values'
import type { SeedTableConfig } from './seed-config'
import type { SeedValue } from './seed-values'

/** One seed file after parsing, before validation. */
export interface LoadedSeedFile {
  /** Basename, e.g. `companies.yaml` — what the operator sees in an error. */
  readonly fileName: string
  readonly table: string
  readonly mergeOn: readonly string[] | undefined
  readonly records: readonly LoadedSeedRecord[]
}

/** One row as read from a seed file. */
export interface LoadedSeedRecord {
  readonly key: string
  readonly fields: Readonly<Record<string, unknown>>
}

/** A row whose values have been classified but whose links are still symbolic. */
export interface PlannedSeedRecord {
  readonly key: string
  readonly fields: Readonly<Record<string, SeedValue>>
}

/** A table ready to write, with its merge key and link fields resolved. */
export interface PlannedSeedTable {
  readonly name: string
  readonly fileName: string
  readonly records: readonly PlannedSeedRecord[]
  /** Columns `--mode upsert` matches on. Empty for the other two modes. */
  readonly mergeOn: readonly string[]
  /** `many-to-many` fields this seed data actually writes to. */
  readonly manyToManyFields: readonly string[]
  /** False when `--table` excluded it; still loaded, so its keys stay resolvable. */
  readonly inScope: boolean
}

const list = (values: readonly string[]): string => values.toSorted().join(', ')

/**
 * A seed file naming a table the config does not declare.
 *
 * Skipping it and exiting `0` is how a renamed table silently stops being
 * seeded — the file keeps sitting in the repository, reviewed and never run.
 */
export const checkUnknownTables = (
  files: readonly LoadedSeedFile[],
  tables: readonly SeedTableConfig[]
): readonly string[] =>
  files
    .filter((file) => findSeedTable(tables, file.table) === undefined)
    .map(
      (file) =>
        `${file.fileName}: no table named "${file.table}" in the config. ` +
        `Tables declared: ${list(tables.map((table) => table.name))}.`
    )

/**
 * `--table X` where no `X` seed file exists.
 *
 * Exiting `0` on an empty selection is the failure mode that makes a broken
 * nightly reset invisible for weeks: the unit is green and the demo is empty.
 */
export const checkRequestedTables = (
  requested: readonly string[],
  files: readonly LoadedSeedFile[]
): readonly string[] => {
  const available = files.map((file) => file.table)
  return requested
    .filter((name) => !available.includes(name))
    .map(
      (name) =>
        `--table ${name}: no seed file for "${name}". ` +
        `Seed files found for: ${list(available)}.`
    )
}

/**
 * Two rows competing for one natural key.
 *
 * Last-one-wins would make every `@table.key` pointing at it a coin flip
 * between two different rows, decided by file order.
 */
export const checkDuplicateKeys = (files: readonly LoadedSeedFile[]): readonly string[] =>
  files.flatMap((file) => {
    const keys = file.records.map((record) => record.key)
    return [...new Set(keys)]
      .filter((key) => keys.filter((candidate) => candidate === key).length > 1)
      .map((key) => `${file.fileName}: duplicate key "${key}". Each key must name one row.`)
  })

/**
 * A seed field the table does not declare.
 *
 * Letting it reach the driver instead reports `column "revenue" does not
 * exist`, which names a column rather than the file that wrote it.
 */
export const checkUndeclaredFields = (
  files: readonly LoadedSeedFile[],
  tables: readonly SeedTableConfig[]
): readonly string[] =>
  files.flatMap((file) => {
    const table = findSeedTable(tables, file.table)
    if (!table) return []
    const declared = table.fields.map((field) => field.name)
    return file.records.flatMap((record) =>
      Object.keys(record.fields)
        .filter((name) => !declared.includes(name))
        .map(
          (name) =>
            `${file.fileName} (key "${record.key}"): "${file.table}" declares no field ` +
            `"${name}". Fields declared: ${list(declared)}.`
        )
    )
  })

/**
 * An attachment field bound to a bucket other than `default`.
 *
 * Auto-signed attachment URLs are always built against
 * `/api/buckets/default/signed`, ignoring the field's declared `bucket`, so a
 * seeded row here carries a link that can never resolve. Refusing is the honest
 * answer until that defect is fixed — the row would look correct in the
 * database and render a broken image forever.
 */
export const checkAttachmentBuckets = (
  planned: readonly PlannedSeedTable[],
  tables: readonly SeedTableConfig[]
): readonly string[] =>
  planned.flatMap((table) => {
    const config = findSeedTable(tables, table.name)
    if (!config) return []
    const written = new Set(table.records.flatMap((record) => Object.keys(record.fields)))
    return config.fields
      .filter(
        (field) =>
          ATTACHMENT_TYPES.has(field.type) &&
          field.bucket !== undefined &&
          field.bucket !== 'default' &&
          written.has(field.name)
      )
      .map(
        (field) =>
          `${table.fileName}: field "${field.name}" targets bucket "${field.bucket}". ` +
          `sovrium seed only writes attachments on the "default" bucket — signed ` +
          `attachment URLs are always built against /api/buckets/default/signed, so a ` +
          `row written here would carry a link that never resolves.`
      )
  })

/**
 * A `@table.key` naming a key its target file does not contain.
 *
 * Storing the literal text in an integer foreign key fails at the driver,
 * pointing at a column instead of at the misspelling. A target table with no
 * seed file at all is NOT an error here: the row may already exist in the
 * database (a table added to a template later references parents seeded
 * months ago), so that case is resolved — or refused — at write time.
 */
export const checkReferenceTargets = (planned: readonly PlannedSeedTable[]): readonly string[] => {
  const keysByTable = new Map(
    planned.map((table) => [table.name, new Set(table.records.map((record) => record.key))])
  )
  return planned.flatMap((table) =>
    table.records.flatMap((record) =>
      Object.values(record.fields)
        .flatMap(referencesOf)
        .filter((ref) => keysByTable.has(ref.table) && !keysByTable.get(ref.table)?.has(ref.key))
        .map(
          (ref) =>
            `${table.fileName} (key "${record.key}"): no row keyed "${ref.key}" in ` +
            `"${ref.table}". Keys available: ` +
            `${list([...(keysByTable.get(ref.table) ?? [])])}.`
        )
    )
  )
}

/**
 * A row pointing at another row in the same table.
 *
 * Resolving one needs a two-pass insert-then-patch, which v1 does not do. The
 * refusal fires only when seed data actually uses such a reference, so a table
 * merely *declaring* a self-link seeds normally.
 */
export const checkSelfReferences = (planned: readonly PlannedSeedTable[]): readonly string[] =>
  planned.flatMap((table) =>
    table.records.flatMap((record) =>
      Object.entries(record.fields)
        .filter(([, value]) => referencesOf(value).some((ref) => ref.table === table.name))
        .map(
          ([field]) =>
            `${table.fileName} (key "${record.key}"): field "${field}" references the same ` +
            `table. Self-referencing links are not supported by sovrium seed yet.`
        )
    )
  )

/**
 * Resolve the columns `--mode upsert` matches on: the file's `mergeOn`, else
 * the table's single `unique: true` field.
 *
 * Zero candidates, or more than one, is refused rather than guessed. Degrading
 * to create duplicates the whole data set on the second run — the exact
 * property the nightly reset depends on — and guessing a column silently
 * overwrites unrelated rows, which is not a failure anyone notices in time.
 */
export const resolveMergeOn = (
  file: LoadedSeedFile,
  table: SeedTableConfig
):
  | { readonly ok: true; readonly mergeOn: readonly string[] }
  | { readonly ok: false; readonly error: string } => {
  const declared = table.fields.map((field) => field.name)
  if (file.mergeOn !== undefined) {
    const unknown = file.mergeOn.filter((name) => !declared.includes(name))
    return unknown.length === 0
      ? { ok: true, mergeOn: file.mergeOn }
      : {
          ok: false,
          error:
            `${file.fileName}: mergeOn names ${list(unknown)}, which "${table.name}" ` +
            `does not declare. Fields declared: ${list(declared)}.`,
        }
  }

  const unique = uniqueFieldNames(table)
  return unique.length === 1 && unique[0] !== undefined
    ? { ok: true, mergeOn: [unique[0]] }
    : {
        ok: false,
        error:
          `${table.name}: --mode upsert needs a merge key. Declare mergeOn in ` +
          `${file.fileName}, or give "${table.name}" exactly one unique: true field ` +
          `(it has ${unique.length}).`,
      }
}

/**
 * `--mode upsert` on a table whose seed data writes a `many-to-many` field.
 *
 * `upsertProgram` writes base columns only — it never splits link fields out of
 * the row — so the permissive alternative writes the record, drops every link,
 * and exits `0`. `if-empty` and `replace` go through `createRecordProgram`,
 * which does split them, and are unaffected.
 */
export const checkUpsertManyToMany = (planned: readonly PlannedSeedTable[]): readonly string[] =>
  planned
    .filter((table) => table.inScope && table.manyToManyFields.length > 0)
    .map(
      (table) =>
        `${table.name}: --mode upsert cannot write the many-to-many field(s) ` +
        `${list(table.manyToManyFields)}. Upsert writes base columns only, so the links ` +
        `would be silently dropped. Use --mode if-empty or --mode replace for this table.`
    )
