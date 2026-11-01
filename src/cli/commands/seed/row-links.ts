/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The links a seeded row makes, written apart from its insert or upsert.
 *
 * Two kinds of link cannot go in with the row. A link to a row of the SAME
 * table may name a row defined later in the file, so it is written once every
 * row of that table exists (`writeSelfLinks`). A many-to-many link to ANOTHER
 * table is a junction row, which needs the rows at both of its ends: it orders
 * no table (`table-order.ts`), so it is written once every table's rows exist
 * (`addCreatedLinks`, or `replaceSeededLinks` on an upsert replay).
 *
 * The record write itself is the seed writer's (`write.ts`), handed in as a
 * {@link WriteRowLinks}, so this module writes nothing itself.
 */

import { referencesOf } from '@/application/use-cases/seed/seed-values'
import { idOfKey, resolveSeedFields } from './resolve'
import { SeedWriteError } from './write-error'
import type { WriteRowLinks } from './links'
import type { Resolved, SeedKeyIndex, SeedResolveContext } from './resolve'
import type { PlannedSeedTable } from '@/application/use-cases/seed/seed-plan'

type PlannedFields = PlannedSeedTable['records'][number]['fields']

/** True when a planned value links to a row of `table` itself. */
const isSelfLink = (table: PlannedSeedTable, value: PlannedFields[string]): boolean =>
  referencesOf(value).some((ref) => ref.table === table.name)

/** A row's fields minus its links to the same table — what the insert writes. */
const withoutSelfLinks = (table: PlannedSeedTable, fields: PlannedFields): PlannedFields =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => !isSelfLink(table, value)))

/**
 * A row's many-to-many links to other tables — written once every table's
 * rows exist. A link to the same table stays with the self-link pass.
 */
const deferredLinksOf = (table: PlannedSeedTable, fields: PlannedFields): PlannedFields =>
  Object.fromEntries(
    Object.entries(fields).filter(
      ([name, value]) => table.manyToManyFields.includes(name) && !isSelfLink(table, value)
    )
  )

/** What a row's insert or upsert writes: neither its self-links nor its deferred links. */
export const rowFieldsOf = (table: PlannedSeedTable, fields: PlannedFields): PlannedFields => {
  const deferred = deferredLinksOf(table, fields)
  return Object.fromEntries(
    Object.entries(withoutSelfLinks(table, fields)).filter(
      ([name]) => !Object.hasOwn(deferred, name)
    )
  )
}

/**
 * The part of every row `pick` selects, resolved in file order: each row may
 * name a key the one before it resolved, so the key index is threaded through.
 */
export const resolveEachRecord = (
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable,
  pick: (fields: PlannedFields) => PlannedFields
): Promise<Resolved<readonly Record<string, unknown>[]>> =>
  table.records.reduce<Promise<Resolved<readonly Record<string, unknown>[]>>>(
    (previous, record) =>
      previous.then(async (carried) => {
        const one = await resolveSeedFields(context, carried.index, pick(record.fields), {
          table: table.name,
          key: record.key,
        })
        return { value: [...carried.value, one.value], index: one.index }
      }),
    Promise.resolve({ value: [], index })
  )

/** Every row's deferred links, resolved now that every table's rows exist. */
export const resolveDeferredLinks = (
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<Resolved<readonly Record<string, unknown>[]>> =>
  resolveEachRecord(context, index, table, (fields) => deferredLinksOf(table, fields))

/** Only a row's links to the same table — what the second pass writes. */
const selfLinksOf = (table: PlannedSeedTable, fields: PlannedFields): PlannedFields =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => isSelfLink(table, value)))

/**
 * The second pass: write every link a row makes to a row of its own table.
 *
 * A self-link cannot go in with the insert, because the row it names may be
 * defined later in the file and so have no id yet. Rows go in with the link
 * empty; once every row of the table exists, each link is written onto the row
 * that carries it. An `upsert` replay goes through here too, writing the same
 * link again onto the row it merged rather than onto a new one.
 */
export const writeSelfLinks = (
  write: WriteRowLinks,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<SeedKeyIndex> =>
  table.records
    .filter((record) => Object.keys(selfLinksOf(table, record.fields)).length > 0)
    .reduce<Promise<SeedKeyIndex>>(
      (previous, record) =>
        previous.then(async (carried) => {
          const resolved = await resolveSeedFields(
            context,
            carried,
            selfLinksOf(table, record.fields),
            { table: table.name, key: record.key }
          )
          const id = idOfKey(resolved.index, table.name, record.key)
          if (id === undefined) {
            throw new SeedWriteError(
              `${table.fileName} (key "${record.key}"): the row was not written, so its link ` +
                `to the same table cannot be.`
            )
          }
          await write({ key: record.key, id }, resolved.value)
          return resolved.index
        }),
      Promise.resolve(index)
    )

/**
 * Add each freshly created row's many-to-many links, once every table's rows
 * exist. The rows are new, so their link sets start empty and an add is the
 * whole write.
 */
export const addCreatedLinks = async (
  write: WriteRowLinks,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<SeedKeyIndex> => {
  if (table.manyToManyFields.length === 0) return index
  const resolved = await resolveDeferredLinks(context, index, table)
  await table.records.reduce<Promise<void>>((previous, record, position) => {
    const links = resolved.value[position] ?? {}
    const id = idOfKey(resolved.index, table.name, record.key)
    if (id === undefined || Object.keys(links).length === 0) return previous
    return previous.then(() => write({ key: record.key, id }, links))
  }, Promise.resolve())
  return resolved.index
}
