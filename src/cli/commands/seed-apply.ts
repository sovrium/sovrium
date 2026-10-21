/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import --apply` — seeding what the import just wrote, in-process.
 *
 * It is exactly `sovrium seed --dir seed/import --mode upsert`: the same
 * migrations, the same plan, the same accounts and the same write path, with
 * the per-table counts handed back for the import's report. Seeding starts no
 * automation and sends no webhook, as a plain seed run does not; and every
 * imported automation is disabled anyway ([internal ref] A14, bounds 8 and 13).
 */

import { buildSeedPlan } from '@/application/use-cases/seed/seed-plan'
import { applyDatabaseMigrations, refuse, requireApp } from './app-prelude'
import { requireAccountPlan, writeRun } from './seed'
import { loadSeedFiles } from './seed-load'

/** What `--apply` did to one table. */
export interface AppliedTable {
  readonly table: string
  readonly inserted: number
  readonly updated: number
  readonly unchanged: number
}

const indent = (lines: readonly string[]): string => lines.map((line) => `  ${line}`).join('\n')

const UPSERT_LINE = /^created (\d+), updated (\d+)(?:, unchanged (\d+))?$/

/** One table's counts, read from the line the seed run printed for it. */
const appliedOf = (table: string, lines: readonly string[]): AppliedTable => {
  const said =
    lines.findLast((line) => line.startsWith(`${table}: `))?.slice(table.length + 2) ?? ''
  const match = UPSERT_LINE.exec(said)
  return {
    table,
    inserted: Number(match?.[1] ?? 0),
    updated: Number(match?.[2] ?? 0),
    unchanged: Number(match?.[3] ?? 0),
  }
}

/** Seed `seedDir` into the app of `configFile` in upsert mode, and return what changed. */
export const applyImportedSeed = async (
  configFile: string,
  seedDir: string
): Promise<readonly AppliedTable[]> => {
  const { app, authoredTableIds } = await requireApp(configFile)
  await applyDatabaseMigrations(app, { authoredTableIds })
  const loaded = await loadSeedFiles(seedDir)
  if (!loaded.ok) return refuse(`Error: seed files could not be read:\n${indent(loaded.errors)}`)
  const planned = buildSeedPlan({
    app,
    files: loaded.files,
    mode: 'upsert',
    requestedTables: [],
    runAt: new Date(),
  })
  if (!planned.ok) return refuse(`Error: seed data was refused:\n${indent(planned.errors)}`)
  const accountPlan = await requireAccountPlan(app, loaded, planned.plan, undefined)
  const lines = await writeRun({
    app,
    plan: planned.plan,
    accountPlan,
    accounts: loaded.accounts,
    mode: 'upsert',
    seedDir,
    options: { configFile, seedDir, mode: 'upsert', tables: [], dryRun: false },
    print: () => undefined,
  }).catch((error: unknown) =>
    refuse(`Error: seeding failed: ${error instanceof Error ? error.message : String(error)}`)
  )
  return planned.plan.order.map((table) => appliedOf(table, lines))
}
