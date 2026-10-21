/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium seed --mode upsert` on a table whose seed data writes many-to-many
 * fields: each seeded row's link set becomes exactly the one its seed record
 * states.
 *
 * ## Why links are written apart from the batch upsert
 *
 * A many-to-many field has no base column — its links are junction rows — and
 * the batch upsert writes base columns. So the link fields are split out of
 * each row before the upsert, and written afterwards onto the row the upsert
 * merged it onto, once its id is known.
 *
 * ## Why REPLACE, and why only on a difference
 *
 * The seed file is the truth about its rows: a link the file no longer lists
 * is removed (the linked row itself is kept), a link it lists is added. A
 * record write's many-to-many value is add-only, and an empty list clears the
 * field, so a replacement is a clear followed by an add. Both are skipped when
 * the stored links already equal the seed's, so replaying the same seed writes
 * nothing at all.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { idOfKey } from './seed-resolve'
import type { SeedKeyIndex } from './seed-resolve'
import type { SeedTableConfig } from '@/application/use-cases/seed/seed-config'
import type { PlannedSeedTable } from '@/application/use-cases/seed/seed-plan'

/** A row's linked ids, by many-to-many field. */
type LinkSet = Readonly<Record<string, readonly (string | number)[]>>

/** A resolved row split into what the upsert writes and the links written after it. */
export interface SplitSeedRow {
  readonly base: Readonly<Record<string, unknown>>
  readonly links: LinkSet
}

/** Refusal raised while replacing a row's links. Message is printed verbatim. */
export class SeedLinkError extends Error {}

/** Split each resolved row into its base columns and its many-to-many links. */
export const splitSeedLinks = (
  table: Pick<PlannedSeedTable, 'manyToManyFields'>,
  rows: readonly Readonly<Record<string, unknown>>[]
): readonly SplitSeedRow[] => {
  const names = new Set(table.manyToManyFields)
  return rows.map((row) => ({
    base: Object.fromEntries(Object.entries(row).filter(([name]) => !names.has(name))),
    links: Object.fromEntries(
      Object.entries(row).flatMap(([name, value]) =>
        names.has(name) ? [[name, toIdList(value)] as const] : []
      )
    ),
  }))
}

const toIdList = (value: unknown): readonly (string | number)[] =>
  value === null || value === undefined
    ? []
    : Array.isArray(value)
      ? (value as readonly (string | number)[])
      : [value as string | number]

/** Whether two id lists name the same rows, in any order. */
export const sameLinks = (
  stored: readonly (string | number)[],
  wanted: readonly (string | number)[]
): boolean => idSetKey(stored) === idSetKey(wanted)

/** One spelling per set of ids, whatever their order, repeats or type. */
const idSetKey = (ids: readonly (string | number)[]): string =>
  JSON.stringify([...new Set(ids.map(String))].toSorted())

/** The related table of each many-to-many field a table's seed writes. */
const linkFieldsOf = (
  table: Pick<PlannedSeedTable, 'name' | 'manyToManyFields'>,
  config: SeedTableConfig | undefined
): readonly { readonly fieldName: string; readonly relatedTable: string }[] =>
  table.manyToManyFields.flatMap((fieldName) => {
    const relatedTable = config?.fields.find((field) => field.name === fieldName)?.relatedTable
    return relatedTable === undefined ? [] : [{ fieldName, relatedTable }]
  })

/** One row's link fields written onto it, by the seed writer. */
export type WriteRowLinks = (
  target: { readonly key: string; readonly id: string | number },
  fields: Readonly<Record<string, unknown>>
) => Promise<void>

/** Everything a link replacement needs from the run. */
export interface ReplaceSeededLinksInput {
  readonly table: PlannedSeedTable
  readonly config: SeedTableConfig | undefined
  readonly index: SeedKeyIndex
  readonly rows: readonly SplitSeedRow[]
  /** The record write — the seed writer's, so this module writes nothing itself. */
  readonly write: WriteRowLinks
}

/**
 * Make every seeded row's many-to-many links exactly the seed's, and return the
 * keys of the rows whose links changed — none on a replay of the same seed.
 */
export const replaceSeededLinks = async (
  input: ReplaceSeededLinksInput
): Promise<ReadonlySet<string>> => {
  const fields = linkFieldsOf(input.table, input.config)
  const targets = input.table.records.flatMap((record, position) => {
    const id = idOfKey(input.index, input.table.name, record.key)
    const links = input.rows[position]?.links ?? {}
    return id === undefined || Object.keys(links).length === 0
      ? []
      : [{ key: record.key, id, links }]
  })
  if (fields.length === 0 || targets.length === 0) return new Set()

  const read = await runTableProgram(
    Effect.gen(function* () {
      const repo = yield* TableRepository
      return yield* repo.readManyToMany({
        sourceTable: input.table.name,
        sourceIds: targets.map((target) => target.id),
        fields,
      })
    })
  )
  if (read._tag === 'Failure') {
    throw new SeedLinkError(
      `${input.table.fileName}: the links already stored could not be read: ${String(read.failure)}`
    )
  }
  const stored = read.success

  return targets.reduce<Promise<ReadonlySet<string>>>(
    (previous, target) =>
      previous.then(async (changed) => {
        const held = stored[String(target.id)] ?? {}
        const differing = Object.entries(target.links).filter(
          ([name, wanted]) => !sameLinks(held[name] ?? [], wanted)
        )
        if (differing.length === 0) return changed
        await input.write(target, Object.fromEntries(differing.map(([name]) => [name, []])))
        const added = differing.filter(([, wanted]) => wanted.length > 0)
        if (added.length > 0) await input.write(target, Object.fromEntries(added))
        return new Set([...changed, target.key])
      }),
    Promise.resolve(new Set<string>())
  )
}

/**
 * The report line of an upsert: a row whose columns were already right but
 * whose links changed counts as updated, not unchanged.
 */
export const upsertReportLine = (input: {
  readonly table: string
  readonly created: number
  readonly updated: number
  readonly unchanged: number
  /** Rows left unchanged by the upsert whose links were then replaced. */
  readonly relinkedOnly: number
}): string => {
  const left = input.unchanged - input.relinkedOnly
  const tail = left > 0 ? `, unchanged ${left}` : ''
  return `${input.table}: created ${input.created}, updated ${input.updated + input.relinkedOnly}${tail}`
}
