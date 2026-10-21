/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A seed that writes an autonumber's values: the next new row continues after
 * the highest.
 *
 * SQLite needs nothing here: its autonumber trigger numbers a new row after the
 * largest number in the column. PostgreSQL numbers it from the column's
 * sequence, which a row inserted with its own number does not move, so the
 * next row would be given a number a seeded row already holds. After a table
 * whose seed wrote autonumber values, its sequence is moved to the highest
 * number the column holds.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { SeedTableConfig } from '@/application/use-cases/seed/seed-config'
import type { PlannedSeedTable } from '@/application/use-cases/seed/seed-plan'

/** Move the sequence of every autonumber field `table`'s seed wrote to its column's highest number. */
export const alignSeededAutonumbers = async (
  table: Pick<PlannedSeedTable, 'name' | 'records'>,
  tables: readonly SeedTableConfig[]
): Promise<void> => {
  if (isSqliteRuntime()) return
  const config = tables.find((one) => one.name === table.name)
  const written = (config?.fields ?? [])
    .filter((field) => field.type === 'autonumber')
    .map((field) => field.name)
    .filter((name) => table.records.some((record) => Object.hasOwn(record.fields, name)))
  // A table served through a view keeps its rows, and the sequence, in `<name>_base`.
  const base = `${table.name}_base`
  await written.reduce<Promise<unknown>>(
    (previous, column) =>
      previous.then(() =>
        executeRaw(
          db,
          sql`SELECT setval(pg_get_serial_sequence(CASE WHEN to_regclass(${base}) IS NULL THEN ${table.name} ELSE ${base} END, ${column}), highest) FROM (SELECT MAX(${sql.identifier(column)}) AS highest FROM ${tableIdentifier(table.name)}) AS numbered WHERE highest IS NOT NULL`
        )
      ),
    Promise.resolve()
  )
}
