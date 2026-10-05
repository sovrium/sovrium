/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A lookup through a many-to-many link copies the related field of EVERY
 * linked row, joined in the database. The link itself is narrowed to the rows
 * its reader may read, so the lookup is too: it is recomputed from the linked
 * rows the reader may read, and left out when none remains.
 *
 * A REVERSE lookup — declared through the link a related table holds — copies
 * every related row pointing back at the record, and is narrowed the same way.
 *
 * The keys are read from the junction here rather than taken off the record:
 * a `?fields=` selection naming the lookup alone carries no link to judge it
 * by. A record whose linked rows are all readable keeps the database's value.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { withFormulasOver } from '@/domain/models/app/tables/lookup-link-service'
import { readableRows, type LinkReader } from './linked-row-visibility'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'

/** A lookup through a many-to-many relationship, and what it copies. */
export interface ManyToManyLookup {
  readonly lookup: string
  readonly relationship: string
  readonly relatedTable: Table
  readonly relatedField: string
  /** The lookup's own `filters`, which a linked row must also pass. */
  readonly filters?: unknown
  /**
   * Set for a REVERSE lookup: the related table's column holding this record's
   * key. The linked rows are then the related rows whose `backLink` names the
   * record, rather than a junction's.
   */
  readonly backLink?: string
}

/** A record's key and its fields. */
export interface KeyedFields {
  readonly id: unknown
  readonly fields: Readonly<Record<string, unknown>>
}

/** A lookup's new value per record index: a string, or `undefined` to leave it out. */
type Patch = ReadonlyMap<number, string | undefined>

/**
 * Order two linked values as the database's `ORDER BY` on the column does for
 * the cases that differ from a string sort: numbers by magnitude (`9` before
 * `10`), everything else by its text.
 */
const compareValues = (a: unknown, b: unknown): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const [left, right] = [String(a), String(b)]
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * A linked value as text; a date-time as its ISO form rather than
 * `Date#toString`, and a `date` field as its day, the way the database joins it.
 */
const asText = (value: unknown, isDay: boolean): string =>
  value instanceof Date
    ? isDay
      ? value.toISOString().slice(0, 10)
      : value.toISOString()
    : String(value)

/** The linked values joined as the database joins them: by value, `, ` between. */
const joinValues = (
  rows: readonly Readonly<Record<string, unknown>>[],
  field: string,
  isDay: boolean
): string =>
  rows
    .map((row) => row[field])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .toSorted(compareValues)
    .map((value) => asText(value, isDay))
    .join(', ')

/** The keys among `keys` whose row passes the lookup's own filters, or all of them. */
const passingLookupFilters = (
  lookup: ManyToManyLookup,
  keys: readonly string[],
  reader: LinkReader
): Effect.Effect<ReadonlySet<string>, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    if (lookup.filters === undefined || keys.length === 0) return new Set(keys)
    const repo = yield* TableRepository
    const rows = yield* repo.listRecords({
      session: reader.session,
      tableName: lookup.relatedTable.name,
      filter: {
        and: [{ field: 'id', operator: 'in', value: keys }, lookup.filters as QueryFilterNode],
      },
    })
    return new Set(rows.map((row) => String(row.id)))
  })

/**
 * The keys each record links to through `lookup`: the junction's rows for a
 * many-to-many link, the related rows whose `backLink` names the record for a
 * reverse one.
 */
const linkedKeysOf = (
  tableName: string,
  lookup: ManyToManyLookup,
  ids: readonly string[],
  reader: LinkReader
): Effect.Effect<ReadonlyMap<string, readonly string[]>, DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const { backLink } = lookup
    if (backLink === undefined) {
      const links = yield* repo.readManyToMany({
        sourceTable: tableName,
        sourceIds: ids,
        fields: [{ fieldName: lookup.relationship, relatedTable: lookup.relatedTable.name }],
      })
      return new Map(ids.map((id) => [id, (links[id]?.[lookup.relationship] ?? []).map(String)]))
    }
    const rows = yield* repo.listRecords({
      session: reader.session,
      tableName: lookup.relatedTable.name,
      filter: { and: [{ field: backLink, operator: 'in', value: ids }] },
    })
    return new Map(
      ids.map((id) => [
        id,
        rows.filter((row) => String(row[backLink]) === id).map((row) => String(row.id)),
      ])
    )
  })

/** The records a pass narrows, the table they come from and who reads them. */
interface NarrowingScope {
  readonly app: App
  readonly tableName: string
  readonly entries: readonly KeyedFields[]
  readonly reader: LinkReader
}

/** The new value of one lookup on every record that carries it and links to a hidden row. */
const patchOf = (
  scope: NarrowingScope,
  lookup: ManyToManyLookup
): Effect.Effect<Patch, DatabaseError, TableRepository | DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const { app, tableName, entries, reader } = scope
    // A record carrying a formula over the lookup is judged too: the formula
    // is computed over every linked row, so it goes when the lookup narrows.
    const judged = withFormulasOver(app, tableName, new Set([lookup.lookup]))
    const carriers = entries.flatMap((entry, index) =>
      [...judged].some((name) => Object.hasOwn(entry.fields, name)) &&
      entry.id !== undefined &&
      entry.id !== null
        ? [{ index, id: String(entry.id) }]
        : []
    )
    if (carriers.length === 0) return new Map()
    const links = yield* linkedKeysOf(
      tableName,
      lookup,
      carriers.map((carrier) => carrier.id),
      reader
    )
    const keysOf = (id: string): readonly string[] => links.get(id) ?? []
    const allKeys = [...new Set(carriers.flatMap((carrier) => keysOf(carrier.id)))]
    const readable = yield* readableRows(app, lookup.relatedTable, allKeys, reader)
    if (readable === undefined) return new Map()
    const narrowed = carriers.filter((carrier) =>
      keysOf(carrier.id).some((key) => !readable.has(key))
    )
    if (narrowed.length === 0) return new Map()
    const passing = yield* passingLookupFilters(lookup, [...readable.keys()], reader)
    const isDayField =
      lookup.relatedTable.fields.find((field) => field.name === lookup.relatedField)?.type ===
      'date'
    return new Map(
      narrowed.map((carrier) => {
        const rows = keysOf(carrier.id)
          .filter((key) => passing.has(key))
          .flatMap((key) => {
            const row = readable.get(key)
            return row === undefined ? [] : [row]
          })
        const value = joinValues(rows, lookup.relatedField, isDayField)
        return [carrier.index, value === '' ? undefined : value] as const
      })
    )
  })

/**
 * The fields of every entry with each many-to-many lookup recomputed from the
 * linked rows `reader` may read — left out when none remains. A reader-less
 * call, an unrestricted reader and a related table with no read rule leave the
 * fields as they are.
 */
export const narrowManyToManyLookups = (input: {
  readonly app: App | undefined
  readonly tableName: string
  readonly entries: readonly KeyedFields[]
  readonly lookups: readonly ManyToManyLookup[]
  readonly reader: LinkReader | undefined
}): Effect.Effect<
  readonly Readonly<Record<string, unknown>>[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, entries, lookups, reader } = input
    const fields = entries.map((entry) => entry.fields)
    if (app === undefined || reader === undefined) return fields
    // Nothing to narrow — and no junction to read — for an unrestricted reader
    // or a related table without a read rule: the database's value stands.
    if (isAdminEquivalent(reader.role, app)) return fields
    const ruled = lookups.filter(
      (lookup) => lookup.relatedTable.rowLevelPermissions?.read?.when !== undefined
    )
    if (ruled.length === 0) return fields
    const patches = yield* Effect.forEach(ruled, (lookup) =>
      patchOf({ app, tableName, entries, reader }, lookup).pipe(
        Effect.map((patch) => [lookup.lookup, patch] as const)
      )
    )
    return fields.map((row, index) => {
      const narrowed = patches.filter(([, patch]) => patch.has(index)).map(([name]) => name)
      if (narrowed.length === 0) return row
      // A formula over a narrowed lookup was computed over the rows the reader
      // may not read as well: it is left out, the lookup recomputed.
      const formulas = withFormulasOver(app, tableName, new Set(narrowed))
      const kept = Object.fromEntries(
        Object.entries(row).filter(([key]) => narrowed.includes(key) || !formulas.has(key))
      )
      return patches.reduce<Readonly<Record<string, unknown>>>((acc, [name, patch]) => {
        if (!patch.has(index) || !Object.hasOwn(acc, name)) return acc
        const value = patch.get(index)
        return value === undefined
          ? Object.fromEntries(Object.entries(acc).filter(([key]) => key !== name))
          : { ...acc, [name]: value }
      }, kept)
    })
  }).pipe(
    Effect.withSpan('tables.narrow-many-to-many-lookups', {
      attributes: { 'table.name': input.tableName },
    })
  )
