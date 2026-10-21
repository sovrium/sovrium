/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium seed --mode upsert` — which rows of a replay would change.
 *
 * A row already holding every value its seed record writes is left alone, not
 * rewritten, so replaying the same seed changes no row; the run counts it as
 * unchanged. Only the other rows reach the batch upsert (`seed-write.ts`).
 *
 * Each row is compared in the form the upsert would store it — a lone account
 * id in a multi-person field is a list of one — and without the columns an
 * update never rewrites. Its files are worked out as storage keys first and
 * stored only for the rows the upsert writes, so an unchanged row stores none.
 */

import { sql } from 'drizzle-orm'
import { insertOnlyColumnsOf } from '@/domain/models/app/tables/insert-only-field-service'
import { storedValuesIn } from '@/domain/models/app/tables/user-list-field-service'
import { isUnchangedSeedRow } from '@/domain/models/seed/seed-replay-service'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { emptyKeyIndex, resolveSeedFields, withKey } from './seed-resolve'
import type { SeedKeyIndex, SeedResolveContext } from './seed-resolve'
import type { PlannedSeedTable } from '@/application/use-cases/seed/seed-plan'
import type { App } from '@/domain/models/app'

/** The rows a replay of `table` would change, and how many it leaves as they are. */
export const partitionReplay = async (
  table: Pick<PlannedSeedTable, 'name' | 'mergeOn'>,
  rows: readonly Readonly<Record<string, unknown>>[],
  app: Readonly<App>
): Promise<{
  readonly changed: readonly Record<string, unknown>[]
  readonly unchanged: number
}> => {
  const held = await executeRaw(db, sql`SELECT * FROM ${tableIdentifier(table.name)}`)
  const insertOnly = insertOnlyColumnsOf(app.tables, table.name)
  const changed = rows.filter((fields) => {
    const stored = storedValuesIn(app.tables, table.name, fields)
    return !isUnchangedSeedRow(held, table.mergeOn, stored, insertOnly)
  })
  return { changed, unchanged: rows.length - changed.length }
}

/**
 * Store the files of the rows a replay writes: each seed record whose
 * resolved row is in `changed`, its `@asset:` fields only, under the key the
 * comparison already worked out.
 */
export const storeChangedAssets = async (
  context: SeedResolveContext,
  table: PlannedSeedTable,
  rows: readonly Readonly<Record<string, unknown>>[],
  changed: readonly Readonly<Record<string, unknown>>[]
): Promise<void> => {
  const written = table.records.filter((_, position) => changed.includes(rows[position] ?? {}))
  await written.reduce<Promise<unknown>>(
    (previous, record) =>
      previous.then(() => {
        const assets = Object.entries(record.fields).filter(
          ([, value]) => value.kind === 'asset' || value.kind === 'assets'
        )
        if (assets.length === 0) return undefined
        const target = { table: table.name, key: record.key }
        return resolveSeedFields(context, emptyKeyIndex, Object.fromEntries(assets), target)
      }),
    Promise.resolve()
  )
}

/** Match every seeded key back to the row `upsert` merged it onto. */
export const indexUpsertedKeys = (
  index: SeedKeyIndex,
  table: PlannedSeedTable,
  resolved: readonly Record<string, unknown>[]
): Promise<SeedKeyIndex> => {
  const matches = (
    row: Readonly<Record<string, unknown>>,
    fields: Readonly<Record<string, unknown>>
  ): boolean => table.mergeOn.every((column) => String(row[column]) === String(fields[column]))
  return executeRaw(db, sql`SELECT * FROM ${tableIdentifier(table.name)}`).then((rows) =>
    table.records.reduce<SeedKeyIndex>((carried, record, position) => {
      const fields = resolved[position]
      const row = fields === undefined ? undefined : rows.find((one) => matches(one, fields))
      const id = row?.id
      return typeof id === 'string' || typeof id === 'number'
        ? withKey(carried, table.name, record.key, id)
        : carried
    }, index)
  )
}
