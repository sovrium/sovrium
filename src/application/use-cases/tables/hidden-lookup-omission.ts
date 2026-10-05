/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `lookup` field copies a field of the row its relationship links to onto
 * the record — computed in the database, so it arrives with the row. It is the
 * related row's value by another road than `_display`, and answers to the same
 * rule: when the reader may not read the linked row, the lookup is left out.
 * The relationship's key stays — it is the record's own value.
 *
 * One helper serves the records API (single read, list, export) and the reads
 * an automation someone started by hand makes as that person.
 *
 * It runs on the RAW row, before field-level read permissions and a `?fields=`
 * selection trim it: both can remove the relationship's key while keeping the
 * lookup, and a lookup whose key is gone can no longer be judged. A
 * many-to-many link has no column on the row — its keys arrive with the
 * junction read — so its lookups are judged in a second pass after it, and
 * recomputed from the linked rows the reader may read rather than left out
 * whole (see `many-to-many-lookup-narrowing.ts`).
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  chainedLookupLinksOf,
  lookupKeyColumnsFor,
  lookupLinksOf,
  namesLookup,
  relatedValuesRefusedTo,
  rowRuledLookupLinksOf,
  withFormulasOver,
  withoutLookups,
  type LookupLink,
  type LookupRoad,
} from '@/domain/models/app/tables/lookup-link-service'
import {
  applyJudgements,
  hiddenOnEveryRow,
  hiddenOutside,
  judgedByLinked,
  keysOf,
  type ClearedKeys,
  type RowVerdict,
} from '@/domain/models/app/tables/lookup-row-judgement-service'
import { readableKeys, relatedReaderOf, type LinkReader } from './linked-row-visibility'
import {
  narrowManyToManyLookups,
  type KeyedFields,
  type ManyToManyLookup,
} from './many-to-many-lookup-narrowing'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'
import type { RelatedReader } from '@/domain/models/app/tables/related-field-read-service'

/**
 * The fields of `tableName` a live change stream leaves out for `reader`:
 * every lookup, rollup or count into a related table or field they may not
 * read, and every formula over one ({@link relatedValuesRefusedTo}), and every
 * lookup through a link to a table with a row-level read rule their role is
 * subject to, or of a lookup that answers to one further along
 * ({@link rowRuledLookupLinksOf}) — the lookups the records API
 * judges against the linked records ({@link omitHiddenLookups}) — and every
 * formula over one of those.
 *
 * A change event is judged in memory, with no read per subscriber, so it cannot
 * tell which linked records this subscriber may read. It withholds the value
 * rather than guess; the subscriber reads it with the records read the change
 * prompts. An admin-equivalent role is governed by no row rule.
 */
export const lookupsWithheldFromStream = (
  app: App,
  tableName: string,
  reader: RelatedReader
): readonly string[] => {
  const refused = relatedValuesRefusedTo(app, tableName, reader)
  const ruled = isAdminEquivalent(reader.role, app)
    ? new Set<string>()
    : new Set(rowRuledLookupLinksOf(app, tableName).map((link) => link.lookup))
  return [...new Set([...refused, ...withFormulasOver(app, tableName, ruled)])]
}

/**
 * A `?fields=` selection widened by the key column of every lookup it names
 * (or a formula over one; {@link lookupKeyColumnsFor}),
 * so the rows read carry the key the lookup is judged by. The response is
 * still trimmed to the selection as asked; the widening only reaches the
 * `SELECT`. `undefined` (no selection) stays `undefined`.
 */
export const withLookupKeyColumns = (
  app: App,
  tableName: string,
  fields: string | undefined
): string | undefined => {
  if (!fields) return fields
  const keys = lookupKeyColumnsFor(
    app,
    tableName,
    fields.split(',').map((name) => name.trim())
  )
  return keys.length === 0 ? fields : [fields, ...keys].join(',')
}

/** How many tables away a lookup chain is followed before it is left out unjudged. */
const MAX_CHAIN_DEPTH = 8

/**
 * Who may read what a lookup of a lookup copies ({@link chainedLookupLinksOf}):
 * the linked records are read, narrowed to the field the lookup copies, and
 * judged as a read of them by the same reader would be — through every link
 * they read in turn — so a record two tables away hides the value as the
 * record in between would. A chain that copies many linked rows (many-to-many,
 * or the link a related table holds) has no single record to judge by, and a
 * chain deeper than {@link MAX_CHAIN_DEPTH} is not followed: both are left out
 * whole for a reader a rule governs.
 */
const chainedVerdicts = <Row extends Readonly<Record<string, unknown>>>(
  input: { readonly app: App; readonly tableName: string; readonly reader: LinkReader },
  rows: readonly Row[],
  scope: { readonly road: LookupRoad | undefined; readonly depth: number }
): Effect.Effect<
  readonly (readonly [LookupLink, RowVerdict<Row>])[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> => {
  const { app, tableName, reader } = input
  if (isAdminEquivalent(reader.role, app)) return Effect.succeed([])
  const links = chainedLookupLinksOf(app, tableName).filter((link) =>
    rows.some((row) => namesLookup(app, tableName, new Set(Object.keys(row)), link.lookup))
  )
  return Effect.forEach(links, (link) => {
    if (link.road !== 'column' || scope.depth >= MAX_CHAIN_DEPTH) {
      const judgedHere =
        link.road === 'column' ? scope.road !== 'junction' : scope.road !== 'column'
      return Effect.succeed(judgedHere ? [[link, hiddenOnEveryRow] as const] : [])
    }
    if (scope.road === 'junction') return Effect.succeed([])
    return clearedKeys(input, link, rows, scope.depth).pipe(
      Effect.map((cleared) => [[link, judgedByLinked<Row>(link, cleared)] as const])
    )
  }).pipe(Effect.map((verdicts) => verdicts.flat()))
}

/**
 * The keys among the records `link` reads whose copied field survives a read
 * of them by `reader` — the linked records read, narrowed to that field (and
 * the keys it is judged by), and passed through the same omission and the
 * same many-to-many narrowing a read of them is: a copied list survives as the
 * linked records she may read.
 */
const clearedKeys = <Row extends Readonly<Record<string, unknown>>>(
  input: { readonly app: App; readonly reader: LinkReader },
  link: LookupLink,
  rows: readonly Row[],
  depth: number
): Effect.Effect<
  ClearedKeys,
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { app, reader } = input
    const keys = [...new Set(rows.flatMap((row) => keysOf(row[link.relationship])))]
    if (keys.length === 0) return { kept: new Set<string>(), narrowed: new Map() }
    const relatedName = link.relatedTable.name
    const kept = new Set([
      'id',
      link.relatedField,
      ...lookupKeyColumnsFor(app, relatedName, [link.relatedField]),
    ])
    const repo = yield* TableRepository
    const linked = yield* repo.listRecords({
      session: reader.session,
      tableName: relatedName,
      filter: { and: [{ field: 'id', operator: 'in', value: keys }] },
    })
    const narrowed = linked.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([name]) => kept.has(name)))
    )
    const judged = yield* omitAndNarrow({
      app,
      tableName: relatedName,
      rows: narrowed,
      reader,
      depth: depth + 1,
    })
    const field = link.relatedField
    const survivors = judged.flatMap((row, index) =>
      Object.hasOwn(row, field)
        ? [{ id: String(row['id']), value: row[field], stored: narrowed[index]?.[field] }]
        : []
    )
    return {
      kept: new Set(survivors.filter((s) => s.value === s.stored).map((s) => s.id)),
      narrowed: new Map(
        survivors.filter((s) => s.value !== s.stored).map((s) => [s.id, s.value] as const)
      ),
    }
  }).pipe(Effect.withSpan('tables.chained-lookup-cleared-keys'))

/**
 * Each lookup the rows carry through a key column (or a junction, on that
 * pass) whose related table has a row rule for `reader`, with its verdict:
 * the linked keys she may read, read once for every row.
 */
const directVerdicts = <Row extends Readonly<Record<string, unknown>>>(
  input: {
    readonly app: App
    readonly tableName: string
    readonly reader: LinkReader
    readonly road: LookupRoad | undefined
  },
  rows: readonly Row[],
  refused: ReadonlySet<string>
): Effect.Effect<
  readonly (readonly [LookupLink, RowVerdict<Row>])[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> => {
  const { app, tableName, reader, road } = input
  const links = lookupLinksOf(app, tableName).filter(
    (link) =>
      !refused.has(link.lookup) &&
      !link.manyToMany &&
      link.road !== 'reverse' &&
      (road === undefined || link.road === road) &&
      rows.some((row) => namesLookup(app, tableName, new Set(Object.keys(row)), link.lookup))
  )
  return Effect.forEach(links, (link) =>
    readableKeys(
      app,
      link.relatedTable,
      [...new Set(rows.flatMap((row) => keysOf(row[link.relationship])))],
      reader
    ).pipe(Effect.map((readable) => [link, hiddenOutside<Row>(link, readable)] as const))
  )
}

/**
 * `rows` with every related value `reader` may not read removed: first,
 * whatever the road, every lookup, rollup or count into a related table or
 * field refused to them and every formula over one
 * ({@link relatedValuesRefusedTo}); then every lookup through a link to a row they
 * may not read — or, for a lookup of a lookup, to a row that hides the value
 * further along ({@link chainedVerdicts}) — and every formula over such a
 * lookup. A reader-less call (a run no person started) leaves every row
 * as it is; a related table with no row rule costs no read. `road` limits the
 * row pass to the links whose keys the rows already carry; omitted, every link
 * is judged.
 */
const omitLookups = <Row extends Readonly<Record<string, unknown>>>(input: {
  readonly app: App | undefined
  readonly tableName: string
  readonly rows: readonly Row[]
  readonly reader: LinkReader | undefined
  readonly road?: LookupRoad
  readonly depth?: number
}): Effect.Effect<
  readonly Row[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, reader, road } = input
    if (app === undefined || reader === undefined || input.rows.length === 0) return input.rows
    const refused = relatedValuesRefusedTo(app, tableName, relatedReaderOf(reader))
    const rows = withoutLookups(input.rows, refused)
    const direct = yield* directVerdicts({ app, tableName, reader, road }, rows, refused)
    const chained = yield* chainedVerdicts({ app, tableName, reader }, rows, {
      road,
      depth: input.depth ?? 0,
    })
    const verdicts = [...direct, ...chained.filter(([link]) => !refused.has(link.lookup))]
    if (verdicts.length === 0) return rows
    return rows.map((row) => applyJudgements(app, tableName, row, verdicts))
  }).pipe(Effect.withSpan('tables.omit-lookups', { attributes: { 'table.name': input.tableName } }))

/**
 * The many-to-many and reverse lookups of `tableName`, recomputed rather than
 * judged by key: both copy the related field of every linked row, so both are
 * narrowed to the rows the reader may read.
 */
const manyToManyLookupsOf = (
  app: App | undefined,
  tableName: string
): readonly ManyToManyLookup[] =>
  app === undefined
    ? []
    : lookupLinksOf(app, tableName)
        .filter((link) => link.manyToMany || link.road === 'reverse')
        .map(({ lookup, relationship, relatedTable, relatedField, filters, road }) => ({
          lookup,
          relationship,
          relatedTable,
          relatedField,
          ...(road === 'reverse' ? { backLink: relationship } : {}),
          ...(filters === undefined ? {} : { filters }),
        }))

/** Every entry with its many-to-many lookups narrowed to the readable linked rows. */
const narrowEntries = (
  app: App | undefined,
  tableName: string,
  entries: readonly KeyedFields[],
  reader: LinkReader | undefined
) =>
  narrowManyToManyLookups({
    app,
    tableName,
    entries,
    lookups: manyToManyLookupsOf(app, tableName),
    reader,
  })

/**
 * {@link omitLookups} over every link, whatever road its keys take, then the
 * many-to-many and reverse lookups narrowed to the linked rows the reader may
 * read — what a read of `rows` by `reader` carries, at `depth` hops into a
 * lookup chain.
 */
const omitAndNarrow = <Row extends Readonly<Record<string, unknown>>>(input: {
  readonly app: App | undefined
  readonly tableName: string
  readonly rows: readonly Row[]
  readonly reader: LinkReader | undefined
  readonly depth?: number
}): Effect.Effect<
  readonly Row[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  omitLookups(input).pipe(
    Effect.flatMap((judged) =>
      narrowEntries(
        input.app,
        input.tableName,
        judged.map((row) => ({ id: row['id'], fields: row })),
        input.reader
      ).pipe(
        Effect.map((narrowed) =>
          judged.map((row, index) => (narrowed[index] === row ? row : (narrowed[index] as Row)))
        )
      )
    ),
    Effect.withSpan('tables.omit-and-narrow-lookups')
  )

/** {@link omitAndNarrow} for a read of `rows` by `reader`. */
export const omitHiddenLookups = <Row extends Readonly<Record<string, unknown>>>(
  app: App | undefined,
  tableName: string,
  rows: readonly Row[],
  reader: LinkReader | undefined
): Effect.Effect<
  readonly Row[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  omitAndNarrow({ app, tableName, rows, reader }).pipe(
    Effect.withSpan('tables.omit-hidden-lookups')
  )

/**
 * {@link omitLookups} over the links whose key is a column of the raw row —
 * judged before field permissions or a `?fields=` trim can take the key away.
 */
export const omitHiddenColumnLookups = <Row extends Readonly<Record<string, unknown>>>(
  app: App | undefined,
  tableName: string,
  rows: readonly Row[],
  reader: LinkReader | undefined
): Effect.Effect<
  readonly Row[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  omitLookups({ app, tableName, rows, reader, road: 'column' }).pipe(
    Effect.withSpan('tables.omit-hidden-column-lookups')
  )

/**
 * {@link omitHiddenLookups} over the `fields` of a page of records, for the
 * links whose keys the junction read merged onto them.
 */
export const omitHiddenRecordLookups = <
  RecordShape extends { readonly id: unknown; readonly fields: Readonly<Record<string, unknown>> },
>(
  app: App | undefined,
  tableName: string,
  records: readonly RecordShape[],
  reader: LinkReader | undefined
): Effect.Effect<
  readonly RecordShape[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  omitLookups({
    app,
    tableName,
    rows: records.map((record) => record.fields),
    reader,
    road: 'junction',
  }).pipe(
    Effect.flatMap((judged) =>
      narrowEntries(
        app,
        tableName,
        records.map((record, index) => ({ id: record.id, fields: judged[index] ?? record.fields })),
        reader
      )
    ),
    Effect.map((fields) =>
      records.map((record, index) =>
        fields[index] === record.fields ? record : { ...record, fields: fields[index] }
      )
    ),
    Effect.withSpan('tables.omit-hidden-record-lookups')
  )

/**
 * Who a write's answer is read as: the reader its caller named (a visitor's
 * create is written by the system but read as the visitor), else the writing
 * session under its role and groups, else nobody — a write with no reader
 * identity (a seed, an automation nobody started) answers the row as stored.
 */
export const writeEchoReaderOf = (
  session: Readonly<UserSession>,
  caller: {
    readonly userRole?: string | undefined
    readonly userGroups?: readonly string[] | undefined
    readonly linkReader?: LinkReader | undefined
  }
): LinkReader | undefined =>
  caller.linkReader ??
  (caller.userRole === undefined
    ? undefined
    : { session, role: caller.userRole, groups: caller.userGroups ?? [] })

/**
 * The stored rows a write answers with, less what a read of them by `reader`
 * would leave out ({@link omitHiddenLookups}): every lookup, rollup, count and
 * formula over one into a related table or field she may not read, and every
 * lookup through a link to a record her row-level rule hides — with the
 * formulas over it. Run on the RAW rows, before the field filter, exactly as a
 * read is: the filter may drop the key a lookup is judged by. Every write door
 * that hands records back answers through this, so the record a writer gets
 * back never holds more than her own read of it.
 */
export const omitFromWriteEcho = <Row extends Readonly<Record<string, unknown>>>(
  app: App | undefined,
  tableName: string,
  rows: readonly Row[],
  reader: LinkReader | undefined
): Effect.Effect<
  readonly Row[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  omitHiddenLookups(app, tableName, rows, reader).pipe(
    Effect.withSpan('tables.omit-from-write-echo', { attributes: { 'table.name': tableName } })
  )

/**
 * {@link omitFromWriteEcho} when the write hands its records back, the rows as
 * written otherwise — a write that answers a count reads nothing more.
 */
export const omitFromWriteEchoWhenReturned = <Row extends Readonly<Record<string, unknown>>>(
  returned: boolean,
  echo: {
    readonly app: App | undefined
    readonly tableName: string
    readonly rows: readonly Row[]
    readonly reader: LinkReader | undefined
  }
): Effect.Effect<
  readonly Row[],
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  (returned
    ? omitFromWriteEcho(echo.app, echo.tableName, echo.rows, echo.reader)
    : Effect.succeed(echo.rows)
  ).pipe(Effect.withSpan('tables.omit-from-write-echo-when-returned'))
