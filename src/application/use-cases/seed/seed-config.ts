/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The narrow view of an app's table config that seeding needs.
 *
 * `App['tables']` is a wide discriminated union over 50 field types, and a
 * seeder only ever asks four questions of a field: what is it called, is it a
 * link, does it carry a unique constraint, and which storage bucket does it
 * name. Projecting once here keeps every call site free of union narrowing that
 * would say nothing about seeding.
 */

import type { App } from '@/domain/models/app'

/**
 * The field properties the seeder reads.
 *
 * `min` / `max` / `options` exist for ONE purpose: explaining a rejection the
 * database has already made. They are never consulted to decide whether a value
 * is acceptable. `sql-check-constraints.ts` generates the CHECK constraints
 * from these same properties, and the driver is the only thing that decides;
 * reading them a second time to pre-validate would be a second decoder, and it
 * would drift from the one that actually rejects the row.
 */
export interface SeedField {
  readonly name: string
  readonly type: string
  readonly unique?: boolean | undefined
  readonly bucket?: string | undefined
  readonly relatedTable?: string | undefined
  readonly relationType?: string | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly options?: readonly (string | { readonly value?: string })[] | undefined
}

/** A table as the seeder sees it. */
export interface SeedTableConfig {
  readonly name: string
  readonly fields: readonly SeedField[]
}

/** Attachment field types, whose value is a storage key rather than data. */
export const ATTACHMENT_TYPES: ReadonlySet<string> = new Set([
  'single-attachment',
  'multiple-attachments',
])

/**
 * The single projection point.
 *
 * One documented structural cast, rather than the same narrowing repeated at
 * every consumer: every property read here is present on every branch of the
 * field union (optional ones as `undefined`), so the projection is total.
 */
export const seedTablesOf = (app: Readonly<App>): readonly SeedTableConfig[] =>
  (app.tables ?? []) as unknown as readonly SeedTableConfig[]

/** The config for one table, or `undefined` when the app declares no such table. */
export const findSeedTable = (
  tables: readonly SeedTableConfig[],
  name: string
): SeedTableConfig | undefined => tables.find((table) => table.name === name)

/** The `unique: true` fields of a table — the fallback merge key for `upsert`. */
export const uniqueFieldNames = (table: SeedTableConfig): readonly string[] =>
  table.fields.filter((field) => field.unique === true).map((field) => field.name)

/** The `many-to-many` field names of a table (no base column; junction rows). */
export const manyToManyFieldNames = (table: SeedTableConfig): readonly string[] =>
  table.fields
    .filter((field) => field.type === 'relationship' && field.relationType === 'many-to-many')
    .map((field) => field.name)
