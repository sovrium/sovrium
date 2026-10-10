/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `sovrium seed` run reports: the lines it prints, the same result per
 * table for a program (`--report <file>`, `seedReportSchema`), and the plan a
 * `--dry-run` prints instead of writing.
 *
 * The per-table entries are read back from the lines the run printed, one line
 * per table in the plan's order. The lines are the contract a person reads; the
 * entries say the same thing, so the two can never disagree.
 */

import { writeFileSync } from 'node:fs'
import { printDocument } from '@/infrastructure/logging/cli-output'
import type { SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { SeedReport, SeedTableResult } from '@/domain/models/api/automations/cloud/seed-run'
import type { SeedMode } from '@/domain/models/seed'

/**
 * Render the per-table report as one document.
 *
 * Dry-run rows stay GLYPH-LESS on purpose: `✓` asserts that something completed,
 * and a row saying what *would* be created has completed nothing. Marking a plan
 * with a success glyph is the same class of lie as reporting a stop that never
 * happened.
 */
export const report = (lines: readonly string[]): void => {
  const dryRun = lines.some((line) => line.startsWith('[dry-run]'))
  // The `no changes written` sentinel becomes the ⚠ header, so it is dropped
  // here rather than repeated as a row.
  const rows = lines
    .map((line) => line.replace(/^\[dry-run\] /, ''))
    .filter((line) => line !== 'no changes written')

  printDocument(
    dryRun
      ? [
          [{ glyph: 'warn' as const, text: 'Dry run — nothing was written.' }],
          rows.map((text) => ({ text })),
          [{ text: 'Re-run without --dry-run to apply this plan.' }],
        ]
      : [rows.map((text) => ({ glyph: 'ok' as const, text }))]
  )
}

/**
 * The report a `--dry-run` prints instead of writing.
 *
 * Under `upsert` it says "would write", never "would create": whether each row
 * is created or updated depends on what the table holds when the run happens,
 * and a dry run that counted replayed rows as creations would misreport every
 * idempotent re-import. Under `if-empty`, a table `present` counts rows for is
 * reported as the skip the real run would make.
 */
export const dryRunLines = (
  plan: SeedPlan,
  mode: SeedMode,
  present: ReadonlyMap<string, number> = new Map()
): readonly string[] =>
  plan.order.flatMap((name) => {
    const table = plan.tables.find((candidate) => candidate.name === name)
    if (table === undefined) return []
    const held = present.get(name) ?? 0
    if (mode === 'if-empty' && held > 0) {
      return [`[dry-run] ${name}: would skip (${held} rows already present)`]
    }
    return mode === 'upsert'
      ? [`[dry-run] ${name}: would write ${table.records.length} records (mode: upsert)`]
      : [`[dry-run] ${name}: would create ${table.records.length} records`]
  })

const count = (raw: string | undefined): number => Number(raw ?? 0)

/** The entry one printed table line stands for, or `undefined` for a line of another shape. */
const resultOf = (table: string, said: string): SeedTableResult | undefined => {
  const seeded = (created: number, updated = 0): SeedTableResult => ({
    table,
    outcome: 'seeded',
    created,
    updated,
  })
  const skipped = /^(?:would skip|skipped) \((\d+) rows already present\)$/.exec(said)
  if (skipped !== null) {
    return { table, outcome: 'skipped', created: 0, updated: 0, present: count(skipped[1]) }
  }
  const upserted = /^created (\d+), updated (\d+)$/.exec(said)
  if (upserted !== null) return seeded(count(upserted[1]), count(upserted[2]))
  const created = /^(?:created|would create|would write) (\d+) records(?: \(mode: upsert\))?$/.exec(
    said
  )
  return created === null ? undefined : seeded(count(created[1]))
}

/**
 * One entry per table of the plan, in its order, read from the run's lines.
 * The LAST line naming a table wins: the accounts line comes first, so a table
 * that happens to be called `accounts` is still read from its own line.
 */
export const seedTableResultsOf = (
  order: readonly string[],
  lines: readonly string[]
): readonly SeedTableResult[] =>
  order.flatMap((table) => {
    const prefix = `${table}: `
    const line = lines
      .map((one) => one.replace(/^\[dry-run\] /, ''))
      .findLast((one) => one.startsWith(prefix))
    const result = line === undefined ? undefined : resultOf(table, line.slice(prefix.length))
    return result === undefined ? [] : [result]
  })

/** The report of a finished run, as `--report <file>` writes it. */
export const seedReportOf = (input: {
  readonly mode: SeedMode
  readonly dryRun: boolean
  readonly order: readonly string[]
  readonly lines: readonly string[]
}): SeedReport => ({
  mode: input.mode,
  dryRun: input.dryRun,
  tables: seedTableResultsOf(input.order, input.lines),
  lines: input.lines,
})

/**
 * Write `content` as the report file. Synchronous, because the refusal case
 * runs inside the process's `exit` handler, where nothing asynchronous runs.
 */
export const writeReportFile = (path: string, content: SeedReport | { readonly error: string }) =>
  writeFileSync(path, `${JSON.stringify(content, undefined, 2)}\n`, 'utf-8')
