/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `count` over a link counts the linked rows in the database, whoever reads
 * it. Its reader lists only the rows her list of the related table admits
 * (`readerRowsOf`), so the count she reads counts only those: where that list
 * is narrowed to the rows a grant names, the count is recounted from the linked
 * rows she may list that pass the count's own filters; where it admits her
 * none, the count is left out, as any value read from a table she may not read
 * is. A formula over a recounted or withheld count is left out with it.
 *
 * A reader whose list admits every row of the related table — an admin, and
 * every reader of a table no grant narrows — keeps the database's count at no
 * extra read. A count whose linked keys are not a list read here (a key column
 * on the row, or the link a related table holds) is left out for a narrowed
 * reader rather than counted over rows she may not list.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  countLinksOf,
  withFormulasOver,
  type LookupLink,
} from '@/domain/models/app/tables/lookup-link-service'
import {
  countsNarrowedFor,
  type RowReadAdmission,
} from '@/domain/models/app/tables/row-read-admission-service'
import { relatedReaderOf } from './linked-row-visibility'
import { readerRowsOf } from './row-read-admission'
import { readManyToManyLinks } from './to-many-link-reads'
import type { LinkReader } from './linked-row-visibility'
import type { KeyedFields } from './many-to-many-lookup-narrowing'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  TableReadError,
  QueryFilterNode,
} from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

type Requirements = TableRepository | DataSourceRepository | AuthRepository

/** A count's new value per entry index: a number, or `undefined` to leave it out. */
type Patch = ReadonlyMap<number, number | undefined>

/** What a pass narrows: the records, the table they come from and who reads them. */
interface CountScope {
  readonly app: App
  readonly tableName: string
  readonly entries: readonly KeyedFields[]
  readonly reader: LinkReader
}

/** The keys among `keys` whose row passes the count's own filters, or all of them. */
const passingCountFilters = (
  link: LookupLink,
  keys: readonly string[],
  reader: LinkReader
): Effect.Effect<ReadonlySet<string>, TableReadError, TableRepository> =>
  Effect.gen(function* () {
    if (link.filters === undefined || keys.length === 0) return new Set(keys)
    const repo = yield* TableRepository
    const rows = yield* repo.listRecords({
      session: reader.session,
      tableName: link.relatedTable.name,
      filter: {
        and: [{ field: 'id', operator: 'in', value: keys }, link.filters as QueryFilterNode],
      },
    })
    return new Set(rows.map((row) => String(row.id)))
  })

/**
 * Each carrier's count recounted from the linked rows the reader may list —
 * the link read as a read of hers narrows it ({@link readManyToManyLinks}).
 */
const recounted = (
  scope: CountScope,
  link: LookupLink,
  carriers: readonly { readonly index: number; readonly id: string }[]
): Effect.Effect<Patch, TableReadError, Requirements> =>
  Effect.gen(function* () {
    const { app, tableName, reader } = scope
    const ids = carriers.map((carrier) => carrier.id)
    const links = yield* readManyToManyLinks(app, tableName, ids, {
      fields: link.relationship,
      reader,
    })
    const keysOf = (id: string): readonly string[] =>
      (links[id]?.[link.relationship] ?? []).map(String)
    const passing = yield* passingCountFilters(
      link,
      [...new Set(ids.flatMap((id) => keysOf(id)))],
      reader
    )
    return new Map(
      carriers.map(
        (carrier) =>
          [carrier.index, keysOf(carrier.id).filter((k) => passing.has(k)).length] as const
      )
    )
  })

/**
 * Whether `link`'s count is recounted for a reader `admission` narrows — from
 * the linked rows her list admits, which only a link read row by row can
 * name — rather than withheld.
 */
const isRecounted = (admission: RowReadAdmission, link: LookupLink): boolean =>
  admission.kind === 'granted-rows' && link.road === 'junction'

/** The new value of one count on every entry that carries it, or of none. */
const patchOf = (
  scope: CountScope,
  link: LookupLink
): Effect.Effect<Patch, TableReadError, Requirements> =>
  Effect.gen(function* () {
    const { app, tableName, entries, reader } = scope
    const judged = withFormulasOver(app, tableName, new Set([link.lookup]))
    const carriers = entries.flatMap((entry, index) =>
      [...judged].some((name) => Object.hasOwn(entry.fields, name)) &&
      entry.id !== undefined &&
      entry.id !== null
        ? [{ index, id: String(entry.id) }]
        : []
    )
    if (carriers.length === 0) return new Map()
    const { admission } = yield* readerRowsOf(app, link.relatedTable.name, reader)
    if (admission.kind === 'every-row') return new Map()
    if (isRecounted(admission, link)) {
      return yield* recounted(scope, link, carriers)
    }
    return new Map(carriers.map((carrier) => [carrier.index, undefined] as const))
  })

/**
 * The counts of `tableName` withheld from every record `reader` reads — each
 * her list narrows that is not recounted for her ({@link isRecounted}) — and
 * every formula over a count her list narrows, which is withheld whether the
 * count is recounted or not. A surface that names columns (an export) leaves
 * them out as it leaves out any value she may not read.
 */
export const countsWithheldFrom = (
  app: App,
  tableName: string,
  reader: LinkReader
): Effect.Effect<ReadonlySet<string>, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const narrowed = countsNarrowedFor(app, tableName, relatedReaderOf(reader))
    if (narrowed.size === 0) return narrowed
    const links = countLinksOf(app, tableName).filter((link) => narrowed.has(link.lookup))
    const recounted = yield* Effect.forEach(links, (link) =>
      Effect.map(readerRowsOf(app, link.relatedTable.name, reader), ({ admission }) =>
        isRecounted(admission, link) ? [link.lookup] : []
      )
    )
    const kept = new Set(recounted.flat())
    return new Set([...narrowed].filter((name) => !kept.has(name)))
  }).pipe(Effect.withSpan('tables.counts-withheld-from'))

/** `row` with each patched count set or left out, and every formula over one left out. */
const applyPatches = (
  app: App,
  tableName: string,
  row: Readonly<Record<string, unknown>>,
  patches: readonly (readonly [string, number | undefined])[]
): Readonly<Record<string, unknown>> => {
  const names = patches.map(([name]) => name)
  const formulas = withFormulasOver(app, tableName, new Set(names))
  const kept = Object.entries(row).filter(([key]) => names.includes(key) || !formulas.has(key))
  return Object.fromEntries(
    kept.flatMap(([key, value]): readonly (readonly [string, unknown])[] => {
      const patch = patches.find(([name]) => name === key)
      if (patch === undefined) return [[key, value]]
      return patch[1] === undefined ? [] : [[key, patch[1]]]
    })
  )
}

/**
 * The fields of every entry with each count over a link recounted from the
 * linked rows `reader` may list, or left out when her list of the related
 * table admits her none. A reader-less call, an admin-equivalent reader and a
 * related table whose list admits her every row leave the fields as they are.
 */
export const narrowLinkCounts = (input: {
  readonly app: App | undefined
  readonly tableName: string
  readonly entries: readonly KeyedFields[]
  readonly reader: LinkReader | undefined
}): Effect.Effect<readonly Readonly<Record<string, unknown>>[], TableReadError, Requirements> =>
  Effect.gen(function* () {
    const { app, tableName, entries, reader } = input
    const fields = entries.map((entry) => entry.fields)
    if (app === undefined || reader === undefined) return fields
    if (isAdminEquivalent(reader.role, app)) return fields
    // Only a count her list narrows reads her grants: an every-row reader of a
    // scope table costs no further query.
    const narrowed = countsNarrowedFor(app, tableName, relatedReaderOf(reader))
    const links = countLinksOf(app, tableName).filter((link) => narrowed.has(link.lookup))
    if (links.length === 0) return fields
    const scope = { app, tableName, entries, reader }
    const patches = yield* Effect.forEach(links, (link) =>
      patchOf(scope, link).pipe(Effect.map((patch) => [link.lookup, patch] as const))
    )
    return fields.map((row, index) => {
      const own = patches.flatMap(([name, patch]) =>
        patch.has(index) ? [[name, patch.get(index)] as const] : []
      )
      return own.length === 0 ? row : applyPatches(app, tableName, row, own)
    })
  }).pipe(
    Effect.withSpan('tables.narrow-link-counts', { attributes: { 'table.name': input.tableName } })
  )

/**
 * {@link narrowLinkCounts} over `scope`'s entries carrying `fields` — the
 * fields an earlier pass already narrowed — for a read's chain of passes.
 */
export const recountLinks =
  (scope: {
    readonly app: App | undefined
    readonly tableName: string
    readonly entries: readonly KeyedFields[]
    readonly reader: LinkReader | undefined
  }) =>
  (fields: readonly Readonly<Record<string, unknown>>[]) =>
    narrowLinkCounts({
      ...scope,
      entries: scope.entries.map((entry, index) => ({
        id: entry.id,
        fields: fields[index] ?? entry.fields,
      })),
    })
