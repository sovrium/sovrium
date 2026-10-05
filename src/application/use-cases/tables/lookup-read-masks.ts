/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which lookups a list query must evaluate as EMPTY for its reader.
 *
 * The value of a lookup is left out of what a reader receives when the linked
 * record is one they may not read. A filter, a sort or an aggregate naming the
 * lookup runs in the database, on the value itself — so it would still steer
 * on it: a `contains` guess confirmed one letter at a time, a hidden row
 * sorted among the named ones, a `max` counting a hidden number. Each lookup
 * the query names, through a related table with a row-level read rule this
 * reader is subject to, is handed to the repository with that rule projected
 * for the reader; the repository evaluates it as empty where the rule fails.
 * A lookup into a related table or field the reader may not read at all is
 * handed over with no rule (`readable: undefined`), which the repository
 * evaluates as empty on every row. A lookup of a lookup a row rule can hide
 * further along is handed over with every record it reads through, each hop
 * with its table's rule projected for the reader: the value is kept on a row
 * whose every hop she may read, and empty on the others. One that copies a
 * list (a many-to-many or reverse link after its key columns) is recomputed
 * through every hop from the listed records she may read, so it keeps her
 * readable names and never a hidden one. Any other chain (a copied formula, a
 * second list, a chain past the depth cap) is empty on every row, and so is a
 * formula over any chained lookup.
 */

import { Effect } from 'effect'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  chainedLookupLinksOf,
  lookupChainOf,
  lookupLinksOf,
  lookupListChainOf,
  relatedValuesRefusedTo,
  withFormulasOver,
  type LookupLink,
} from '@/domain/models/app/tables/lookup-link-service'
import { projectWhenToFilter } from '@/domain/models/app/tables/row-level-evaluator-service'
import { relatedReaderOf, type LinkReader } from './linked-row-visibility'
import { loadCurrentUserContext } from './permissions/row-level-enforcement'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  LookupReadList,
  LookupReadMask,
  QueryFilterNode,
} from '@/application/ports/repositories/tables/table-repository'
import type { App, Table } from '@/domain/models/app'

/** What a list query names: its filter, its sort, its aggregates and its groups. */
export interface NamedByQuery {
  readonly filter?: unknown
  readonly sort?: string
  readonly aggregate?: Readonly<Record<string, unknown>>
  /**
   * The `groupBy` levels: a group's NAME is the lookup's value, so a level
   * naming a lookup reads it as masked, like a filter or a sort does.
   */
  readonly groupBy?: string
}

/** Every `field` a filter tree names. */
const filterFields = (node: unknown): readonly string[] => {
  if (Array.isArray(node)) return node.flatMap(filterFields)
  if (node === null || typeof node !== 'object') return []
  const { field } = node as { readonly field?: unknown }
  const own = typeof field === 'string' ? [field] : []
  return [...own, ...Object.values(node).flatMap(filterFields)]
}

/** Every field name the query steers on. */
const namedFields = (query: NamedByQuery): ReadonlySet<string> =>
  new Set([
    ...filterFields(query.filter),
    ...(query.sort ?? '').split(',').map((part) => part.split(':')[0]?.trim() ?? ''),
    ...(query.groupBy ?? '').split(',').map((level) => level.trim()),
    ...Object.values(query.aggregate ?? {}).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : []
    ),
  ])

/** Where a mask finds a row's linked records: its key column, a junction, or a back link. */
const maskLinkOf = (link: LookupLink): LookupReadMask['link'] => {
  const filters = link.filters === undefined ? {} : { filters: link.filters as QueryFilterNode }
  if (link.manyToMany) return { kind: 'junction', ...filters }
  if (link.road === 'reverse') return { kind: 'reverse', column: link.relationship, ...filters }
  return { kind: 'column', column: link.relationship }
}

/**
 * The always-empty mask of a field reading a related table or field the reader
 * may not read — a lookup, a rollup, a count, or a formula over one. With no
 * rule (`readable: undefined`) the repository reads it as empty on every row
 * and never reads its link, so the column names itself throughout.
 */
const refusedMask = (field: string): LookupReadMask => ({
  lookup: field,
  relatedTable: field,
  relatedField: field,
  readable: undefined,
  link: { kind: 'column', column: field },
})

/**
 * The lookups of a lookup a row rule can hide further along, less the refused
 * ones: a rule projected on their own link would not reach the record two
 * tables away, so each is judged hop by hop ({@link chainMaskOf}).
 */
const chainedLookupsOf = (
  app: App,
  tableName: string,
  refused: ReadonlySet<string>
): ReadonlySet<string> =>
  new Set(
    chainedLookupLinksOf(app, tableName)
      .map((link) => link.lookup)
      .filter((field) => !refused.has(field))
  )

/** `table`'s row-level read rule projected for `reader`; `undefined` when it carries none. */
const projectedRuleOf = (
  app: App,
  table: Table,
  reader: LinkReader
): Effect.Effect<QueryFilterNode | undefined, never, DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const rlp = table.rowLevelPermissions
    const when = rlp?.read?.when
    if (when === undefined) return undefined
    const ctx = yield* loadCurrentUserContext(
      {
        userId: reader.session.userId,
        role: reader.role,
        isUnrestricted: isAdminEquivalent(reader.role, app),
      },
      rlp
    )
    return projectWhenToFilter(when, ctx) as QueryFilterNode
  }).pipe(Effect.withSpan('tables.projected-lookup-rule'))

/** A lookup's mask with its related table's read rule projected for `reader`. */
const ruledMaskOf = (
  app: App,
  link: LookupLink,
  reader: LinkReader
): Effect.Effect<LookupReadMask, never, DataSourceRepository | AuthRepository> =>
  projectedRuleOf(app, link.relatedTable, reader).pipe(
    Effect.map((readable): LookupReadMask => ({
      lookup: link.lookup,
      relatedTable: link.relatedTable.name,
      relatedField: link.relatedField,
      readable,
      link: maskLinkOf(link),
    })),
    Effect.withSpan('tables.ruled-lookup-mask')
  )

/**
 * The list a chain copies at its end, with the listed table's rule projected
 * for `reader`; `sourceTable` is the table holding the link — the last hop's.
 */
const listOf = (
  app: App,
  list: LookupLink,
  sourceTable: string,
  reader: LinkReader
): Effect.Effect<LookupReadList, never, DataSourceRepository | AuthRepository> =>
  projectedRuleOf(app, list.relatedTable, reader).pipe(
    Effect.map((readable): LookupReadList => ({
      kind: list.road === 'reverse' ? 'reverse' : 'junction',
      sourceTable,
      relatedTable: list.relatedTable.name,
      relatedField: list.relatedField,
      readable,
      ...(list.road === 'reverse' ? { column: list.relationship } : {}),
      ...(list.filters === undefined ? {} : { filters: list.filters as QueryFilterNode }),
    }))
  )

/** A chain a list query judges: its key-column hops, and the list it copies at the end. */
interface JudgedChain {
  readonly hops: readonly LookupLink[]
  readonly list?: LookupLink
}

/**
 * The chain `field` of `tableName` is judged by: one record per hop, else a
 * list after its key columns; `undefined` when neither shape fits.
 */
const judgedChainOf = (app: App, tableName: string, field: string): JudgedChain | undefined => {
  const hops = lookupChainOf(app, tableName, field)
  return hops === undefined ? lookupListChainOf(app, tableName, field) : { hops }
}

/**
 * The mask of a lookup of a lookup: every record it reads through, each with
 * its table's rule projected for `reader`, so the value is kept on the rows
 * whose every hop she may read and evaluated as empty on the others — or,
 * when it copies a list, recomputed from the listed records she may read.
 */
const chainMaskOf = (
  app: App,
  { hops, list }: JudgedChain,
  reader: LinkReader
): Effect.Effect<LookupReadMask, never, DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const last = hops.at(-1)
    return list === undefined || last === undefined
      ? undefined
      : yield* listOf(app, list, last.relatedTable.name, reader)
  }).pipe(
    Effect.flatMap((terminal) => chainHopsMaskOf(app, hops, reader, terminal)),
    Effect.withSpan('tables.chained-lookup-mask')
  )

/** The `chain` mask over `hops`, each with its table's rule projected for `reader`. */
const chainHopsMaskOf = (
  app: App,
  hops: readonly LookupLink[],
  reader: LinkReader,
  list: LookupReadList | undefined
): Effect.Effect<LookupReadMask, never, DataSourceRepository | AuthRepository> =>
  Effect.forEach(hops, (hop) =>
    projectedRuleOf(app, hop.relatedTable, reader).pipe(
      Effect.map((readable) => ({
        column: hop.relationship,
        relatedTable: hop.relatedTable.name,
        readable,
      }))
    )
  ).pipe(
    Effect.map((chain): LookupReadMask => {
      const [first] = hops as readonly [LookupLink, ...LookupLink[]]
      return {
        lookup: first.lookup,
        relatedTable: first.relatedTable.name,
        relatedField: first.relatedField,
        readable: undefined,
        link: { kind: 'chain', hops: chain, ...(list === undefined ? {} : { list }) },
      }
    }),
    Effect.withSpan('tables.chained-lookup-hops-mask')
  )

/**
 * The fields of `tableName` the query names that `reader` may not always
 * read: those reading a related table or field refused to them (lookups,
 * rollups, counts and formulas over them) and every formula over a lookup a
 * row-level rule may hide from them, masked as empty on every row, and
 * the lookups whose linked record they may not always read, each
 * with the related table's read rule projected for this reader. Empty for a
 * reader-less call or a query that names no such lookup.
 */
export const lookupReadMasks = (
  app: App,
  tableName: string,
  reader: LinkReader | undefined,
  query: NamedByQuery
): Effect.Effect<readonly LookupReadMask[], never, DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    if (reader === undefined) return []
    const named = namedFields(query)
    const refused = relatedValuesRefusedTo(app, tableName, relatedReaderOf(reader))
    const refusedMasks = [...refused].filter((field) => named.has(field)).map(refusedMask)
    if (isAdminEquivalent(reader.role, app)) return refusedMasks
    const chained = chainedLookupsOf(app, tableName, refused)
    const ruledLinks = lookupLinksOf(app, tableName).filter(
      (link) =>
        !refused.has(link.lookup) &&
        !chained.has(link.lookup) &&
        (link.manyToMany || link.road === 'column' || link.road === 'reverse') &&
        link.relatedTable.rowLevelPermissions?.read?.when !== undefined
    )
    // A formula over a lookup a row rule may hide is masked as empty on every
    // row: the rule's projection reads the lookup's link, not the formula's.
    const ruledLookups = new Set(ruledLinks.map((link) => link.lookup))
    // A lookup of a lookup judged hop by hop is narrowed per row, and one
    // copying a list is recomputed from the listed records she may read; any
    // other chain stays empty on every row.
    const chains = [...chained]
      .filter((field) => named.has(field))
      .flatMap((field) => {
        const chain = judgedChainOf(app, tableName, field)
        return chain === undefined ? [] : [[field, chain] as const]
      })
    const judged = new Set(chains.map(([field]) => field))
    const formulaMasks = [
      ...withFormulasOver(app, tableName, new Set([...ruledLookups, ...chained])),
    ]
      .filter(
        (field) =>
          !ruledLookups.has(field) && !judged.has(field) && !refused.has(field) && named.has(field)
      )
      .map(refusedMask)
    const links = ruledLinks.filter((link) => named.has(link.lookup))
    const ruledMasks = yield* Effect.forEach(links, (link) => ruledMaskOf(app, link, reader))
    const chainedMasks = yield* Effect.forEach(chains, ([, chain]) =>
      chainMaskOf(app, chain, reader)
    )
    return [...refusedMasks, ...formulaMasks, ...ruledMasks, ...chainedMasks]
  }).pipe(Effect.withSpan('tables.lookup-read-masks', { attributes: { 'table.name': tableName } }))
