/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The links a table's `lookup`, `rollup` and `count` fields read through, and
 * which of those fields a reader may not read at all.
 *
 * Each of them reads the rows its relationship links to. Whether a reader may
 * see what it reads is first a question about the SCHEMA — may they read the
 * related table, and the related field ({@link mayReadRelatedField}, the rule
 * a relationship's label answers to as well)? — and, for a lookup only, then
 * about the linked ROWS, which the read surfaces ask with the rows in hand (a
 * rollup and a count aggregate every related record whatever the reader's row
 * rule). This module answers the schema half, so every surface that hands a
 * record out (the records API, a page drawn on the server, a change stream)
 * leaves out the same fields — and the formulas built over them.
 */

import {
  mayReadRelatedField,
  mayReadRelatedTable,
  type RelatedReader,
} from './related-field-read-service'
import { extractFieldReferences } from './table-formula-validation'
import type { App, Table } from '@/domain/models/app'

/**
 * Where a link's keys live: a `column` on the row itself (many-to-one,
 * one-to-one), a `junction` read that is merged onto the record later
 * (many-to-many, one-to-many), or — `reverse` — a column of the RELATED rows
 * that points back at this one (a lookup declared through the link a related
 * table holds, read on the table it points at).
 */
export type LookupRoad = 'column' | 'junction' | 'reverse'

/**
 * A lookup field, the relationship it reads through, and that link's table.
 * On the `reverse` road, `relationship` is the RELATED table's field — the
 * column of the related rows that holds this record's key.
 */
export interface LookupLink {
  readonly lookup: string
  readonly relationship: string
  readonly relatedTable: Table
  readonly road: LookupRoad
  readonly manyToMany: boolean
  readonly relatedField: string
  readonly filters?: unknown
}

const roadOf = (relationType: unknown): LookupRoad =>
  relationType === 'many-to-many' || relationType === 'one-to-many' ? 'junction' : 'column'

/**
 * The reverse road of a lookup whose `relationshipField` is not a relationship
 * of its own table: the first OTHER table holding a relationship of that name
 * — the same table the database view computes the lookup over
 * (`findReverseLookupTable`), so the lookup is judged over the rows it copies.
 */
const reverseLinkOf = (
  app: App,
  tableName: string,
  lookup: { readonly name: string; readonly relationshipField: unknown },
  rest: { readonly relatedField: unknown; readonly filters: unknown }
): readonly LookupLink[] => {
  const table = app.tables?.find(
    (t) =>
      t.name !== tableName &&
      t.fields.some((f) => f.name === lookup.relationshipField && f.type === 'relationship')
  )
  return table === undefined
    ? []
    : [
        {
          lookup: lookup.name,
          relationship: String(lookup.relationshipField),
          relatedTable: table,
          road: 'reverse',
          manyToMany: false,
          relatedField: String(rest.relatedField),
          ...(rest.filters === undefined ? {} : { filters: rest.filters }),
        },
      ]
}

/** The field types that read a related table through a relationship. */
type DerivedType = 'lookup' | 'rollup' | 'count'

const LOOKUPS: ReadonlySet<DerivedType> = new Set(['lookup'])
const DERIVED: ReadonlySet<DerivedType> = new Set(['lookup', 'rollup', 'count'])

/**
 * The fields of `tableName` of the given types whose relationship links to a
 * declared table, each with that link. A `count` reads no field: its
 * `relatedField` is empty.
 */
const derivedLinksOf = (
  app: App,
  tableName: string,
  types: ReadonlySet<DerivedType>
): readonly LookupLink[] => {
  const fields = app.tables?.find((t) => t.name === tableName)?.fields ?? []
  return fields.flatMap((field): readonly LookupLink[] => {
    if (!types.has(field.type as DerivedType)) return []
    const { relationshipField, filters } = field as {
      readonly relationshipField?: unknown
      readonly filters?: unknown
    }
    const raw = (field as { readonly relatedField?: unknown }).relatedField
    const relatedField = field.type === 'count' || raw === undefined ? '' : raw
    const relationship = fields.find((f) => f.name === relationshipField)
    // Whatever the view reads as a reverse lookup is judged as one: a name
    // that is not a relationship of this table, declared or not.
    if (relationship?.type !== 'relationship') {
      return reverseLinkOf(
        app,
        tableName,
        { name: field.name, relationshipField },
        { relatedField, filters }
      )
    }
    const { relatedTable, relationType } = relationship as {
      readonly relatedTable?: unknown
      readonly relationType?: unknown
    }
    const table = app.tables?.find((t) => t.name === relatedTable)
    return table === undefined
      ? []
      : [
          {
            lookup: field.name,
            relationship: relationship.name,
            relatedTable: table,
            road: roadOf(relationType),
            manyToMany: relationType === 'many-to-many',
            relatedField: String(relatedField),
            ...(filters === undefined ? {} : { filters }),
          },
        ]
  })
}

/** The lookups of `tableName` whose relationship links to a declared table. */
export const lookupLinksOf = (app: App, tableName: string): readonly LookupLink[] =>
  derivedLinksOf(app, tableName, LOOKUPS)

/** Does `table` declare a row-level read rule? */
const isRowRuled = (table: Table): boolean => table.rowLevelPermissions?.read?.when !== undefined

/**
 * Does `field` of `tableName` copy a value a row-level read rule can hide —
 * a lookup through a link to a table with such a rule, a lookup of such a
 * field however many tables away, or a formula over one? A rollup and a count
 * aggregate every related record whatever the reader's row rule, so neither
 * counts. `seen` stops a chain that loops back on itself.
 */
const readsRowRuledValue = (
  app: App,
  target: { readonly tableName: string; readonly field: string },
  seen: ReadonlySet<string>
): boolean => {
  const { tableName, field } = target
  const key = `${tableName}.${field}`
  if (seen.has(key)) return false
  const next = new Set([...seen, key])
  const link = lookupLinksOf(app, tableName).find((candidate) => candidate.lookup === field)
  if (link !== undefined) {
    return (
      isRowRuled(link.relatedTable) ||
      readsRowRuledValue(app, { tableName: link.relatedTable.name, field: link.relatedField }, next)
    )
  }
  const refs = formulaReferencesOf(app, tableName).find(([name]) => name === field)?.[1]
  return [...(refs ?? [])].some((ref) => readsRowRuledValue(app, { tableName, field: ref }, next))
}

/**
 * The lookups of `tableName` that copy a lookup (or a formula over one) a
 * row-level rule can hide further along — a lookup of a lookup, judged by
 * every record it reads through, not only the one its own link names. A
 * reader may read the record in between and still not the one two tables
 * away.
 */
export const chainedLookupLinksOf = (app: App, tableName: string): readonly LookupLink[] =>
  lookupLinksOf(app, tableName).filter((link) =>
    readsRowRuledValue(
      app,
      { tableName: link.relatedTable.name, field: link.relatedField },
      new Set([`${tableName}.${link.lookup}`])
    )
  )

/** How many links a lookup chain is followed through before it is judged unreadable. */
export const MAX_LOOKUP_CHAIN_DEPTH = 8

/**
 * Every link `lookup` of `tableName` reads through, hop after hop, while the
 * field it copies is itself a lookup — up to the last link into a table with a
 * row-level read rule, so each hop a rule can hide the value at is named and
 * none after. `undefined` when the chain cannot be judged one record per hop:
 * a link that is not a key column (many-to-many, one-to-many, a reverse
 * lookup), a copied formula over a value a rule can hide, a chain longer than
 * {@link MAX_LOOKUP_CHAIN_DEPTH} links (a chain that loops back on itself is
 * one), or a field that is no lookup.
 */
export const lookupChainOf = (
  app: App,
  tableName: string,
  lookup: string
): readonly LookupLink[] | undefined => {
  const walk = (
    target: { readonly tableName: string; readonly field: string },
    hops: readonly LookupLink[]
  ): readonly LookupLink[] | undefined => {
    if (hops.length >= MAX_LOOKUP_CHAIN_DEPTH) return undefined
    const link = lookupLinksOf(app, target.tableName).find((c) => c.lookup === target.field)
    if (link?.road !== 'column') return undefined
    const path = [...hops, link]
    const next = { tableName: link.relatedTable.name, field: link.relatedField }
    if (lookupLinksOf(app, next.tableName).some((c) => c.lookup === next.field)) {
      return walk(next, path)
    }
    return readsRowRuledValue(app, next, new Set()) ? undefined : path
  }
  const path = walk({ tableName, field: lookup }, [])
  if (path === undefined) return undefined
  const last = path.reduce(
    (found, link, index) => (isRowRuled(link.relatedTable) ? index : found),
    -1
  )
  return last < 0 ? undefined : path.slice(0, last + 1)
}

/**
 * A lookup of a lookup that copies a LIST: the key-column links it reads
 * through (`hops`, one record each) and the many-to-many or reverse link at
 * the end (`list`) whose related rows the copied value joins.
 */
export interface LookupListChain {
  readonly hops: readonly LookupLink[]
  readonly list: LookupLink
}

/** The field types whose value is computed from other values rather than stored. */
const COMPUTED_TYPES: ReadonlySet<string> = new Set([
  'lookup',
  'rollup',
  'count',
  'formula',
  'relationship',
])

/** Is `field` a value `table` stores as it is — declared, and computed from nothing else? */
const isStoredField = (table: Table, field: string): boolean =>
  table.fields.some((candidate) => candidate.name === field && !COMPUTED_TYPES.has(candidate.type))

/**
 * Every link `lookup` of `tableName` reads through when it copies a list: one
 * key column after the next, while the field it copies is itself a lookup, up
 * to exactly one many-to-many or reverse link at the end whose related field
 * is a stored value no row rule hides further along. `undefined` for any other
 * shape — no key column before the list, a one-to-many or second list link, a
 * copied lookup, formula, rollup or count at the end, or a chain longer than
 * {@link MAX_LOOKUP_CHAIN_DEPTH} links — which stays judged as unreadable.
 */
export const lookupListChainOf = (
  app: App,
  tableName: string,
  lookup: string
): LookupListChain | undefined => {
  const walk = (
    target: { readonly tableName: string; readonly field: string },
    hops: readonly LookupLink[]
  ): LookupListChain | undefined => {
    if (hops.length >= MAX_LOOKUP_CHAIN_DEPTH) return undefined
    const link = lookupLinksOf(app, target.tableName).find((c) => c.lookup === target.field)
    if (link === undefined) return undefined
    const next = { tableName: link.relatedTable.name, field: link.relatedField }
    if (link.road === 'column') return walk(next, [...hops, link])
    if (hops.length === 0 || !(link.manyToMany || link.road === 'reverse')) return undefined
    const plain =
      isStoredField(link.relatedTable, link.relatedField) &&
      !readsRowRuledValue(app, next, new Set())
    return plain ? { hops, list: link } : undefined
  }
  return walk({ tableName, field: lookup }, [])
}

/**
 * The lookups of `tableName` a row-level rule can hide from a reader: those
 * through a link to a table with such a rule, and those of a lookup that
 * answers to one further along ({@link chainedLookupLinksOf}).
 */
export const rowRuledLookupLinksOf = (app: App, tableName: string): readonly LookupLink[] => {
  const chained = new Set(chainedLookupLinksOf(app, tableName).map((link) => link.lookup))
  return lookupLinksOf(app, tableName).filter(
    (link) => isRowRuled(link.relatedTable) || chained.has(link.lookup)
  )
}

/**
 * The tables with a row-level read rule that `field` of `tableName` reads
 * through, at any hop — the related table of a lookup, of a lookup of that
 * lookup, and of every lookup a formula names. A value read with the engine's
 * authority carries what each of their rules would hide.
 */
const ruledTablesBehind = (
  app: App,
  target: { readonly tableName: string; readonly field: string },
  seen: ReadonlySet<string>
): readonly Table[] => {
  const { tableName, field } = target
  const key = `${tableName}.${field}`
  if (seen.has(key)) return []
  const next = new Set([...seen, key])
  const link = lookupLinksOf(app, tableName).find((candidate) => candidate.lookup === field)
  if (link !== undefined) {
    return [
      ...(isRowRuled(link.relatedTable) ? [link.relatedTable] : []),
      ...ruledTablesBehind(
        app,
        { tableName: link.relatedTable.name, field: link.relatedField },
        next
      ),
    ]
  }
  const refs = formulaReferencesOf(app, tableName).find(([name]) => name === field)?.[1]
  return [...(refs ?? [])].flatMap((ref) => ruledTablesBehind(app, { tableName, field: ref }, next))
}

/**
 * The tables with a row-level read rule that any of `fields` of `tableName`
 * reads through — once each, by name.
 */
export const rowRuledTablesBehind = (
  app: App,
  tableName: string,
  fields: Iterable<string>
): readonly Table[] => {
  const tables = [...fields].flatMap((field) =>
    ruledTablesBehind(app, { tableName, field }, new Set())
  )
  return tables.filter(
    (table, index) => tables.findIndex((other) => other.name === table.name) === index
  )
}

/** Each formula field of `tableName`, with the field names its expression names. */
const formulaReferencesOf = (
  app: App,
  tableName: string
): readonly (readonly [string, ReadonlySet<string>])[] =>
  (app.tables?.find((t) => t.name === tableName)?.fields ?? []).flatMap((field) => {
    const { formula } = field as { readonly formula?: unknown }
    return field.type === 'formula' && typeof formula === 'string'
      ? [[field.name, new Set(extractFieldReferences(formula))] as const]
      : []
  })

/**
 * May `reader` see the value `link` reads? The related table must be theirs
 * to read, and so must the related field (a `count` reads none) — and so must
 * whatever that field is built from: when it is itself a lookup, a rollup or a
 * count, the value it reads in turn (a lookup of a lookup reads two tables
 * away); when it is a formula, every value its expression names, however many
 * formulas deep ({@link relatedFieldRefused}). `seen` stops a chain that loops
 * back on itself.
 */
const maySeeLinkSource = (
  app: App,
  reader: RelatedReader,
  link: LookupLink,
  seen: ReadonlySet<string>
): boolean => {
  const relatedTable = link.relatedTable.name
  if (link.relatedField === '') return mayReadRelatedTable(app, reader, relatedTable)
  if (!mayReadRelatedField(app, reader, relatedTable, link.relatedField)) return false
  return !relatedFieldRefused(
    app,
    reader,
    { tableName: relatedTable, field: link.relatedField },
    seen
  )
}

/**
 * Is `field` of `tableName` a value {@link relatedValuesRefusedTo} would leave
 * out for `reader` — a lookup, rollup or count reading what they may not read,
 * or a formula over one, directly or through another formula? Judged for the
 * one field rather than the whole table, with `seen` carried through so a
 * lookup chain that comes back to a field already asked about ends there.
 */
const relatedFieldRefused = (
  app: App,
  reader: RelatedReader,
  target: { readonly tableName: string; readonly field: string },
  seen: ReadonlySet<string>
): boolean => {
  const { tableName, field } = target
  const key = `${tableName}.${field}`
  if (seen.has(key)) return false
  const next = new Set([...seen, key])
  const reads = derivedLinksOf(app, tableName, DERIVED).filter((inner) => inner.lookup === field)
  if (reads.some((inner) => !maySeeLinkSource(app, reader, inner, next))) return true
  const refs = formulaReferencesOf(app, tableName).find(([name]) => name === field)?.[1]
  return [...(refs ?? [])].some((ref) =>
    relatedFieldRefused(app, reader, { tableName, field: ref }, next)
  )
}

/**
 * `refused` widened by every formula that names a refused field, directly or
 * through another formula — a formula over a value its reader may not see
 * would hand it back computed.
 */
const withDependentFormulas = (
  formulas: readonly (readonly [string, ReadonlySet<string>])[],
  refused: ReadonlySet<string>
): ReadonlySet<string> => {
  const added = formulas
    .filter(([name, refs]) => !refused.has(name) && [...refs].some((ref) => refused.has(ref)))
    .map(([name]) => name)
  return added.length === 0
    ? refused
    : withDependentFormulas(formulas, new Set([...refused, ...added]))
}

/**
 * `names` widened by every formula of `tableName` built over one of them,
 * directly or through another formula — what leaving `names` out of a record
 * must leave out with them, or the formula hands the value back computed.
 */
export const withFormulasOver = (
  app: App,
  tableName: string,
  names: ReadonlySet<string>
): ReadonlySet<string> =>
  names.size === 0 ? names : withDependentFormulas(formulaReferencesOf(app, tableName), names)

/**
 * Does `names` hold `lookup`, or a formula built over it? Either one is judged
 * by the lookup's linked record, so either one needs the lookup's link.
 */
export const namesLookup = (
  app: App,
  tableName: string,
  names: ReadonlySet<string>,
  lookup: string
): boolean => [...withFormulasOver(app, tableName, new Set([lookup]))].some((n) => names.has(n))

/**
 * The key columns a read narrowed to `fields` must also fetch so each lookup
 * it carries — or a formula over one — can be judged by its linked record:
 * the relationship column of every lookup whose key lives on the row, less
 * those `fields` already names. The answer is still narrowed to `fields`; only
 * the read is widened.
 */
export const lookupKeyColumnsFor = (
  app: App,
  tableName: string,
  fields: readonly string[]
): readonly string[] => {
  const named = new Set(fields)
  return [
    ...new Set(
      lookupLinksOf(app, tableName)
        .filter((link) => link.road === 'column' && namesLookup(app, tableName, named, link.lookup))
        .map((link) => link.relationship)
        .filter((key) => !named.has(key))
    ),
  ]
}

/**
 * The fields of `tableName` that read a related table `reader` may not read —
 * a lookup or a rollup into a related table or field refused to them, a count
 * of a related table refused to them — and every formula built over one of
 * them. Each is left out of every record, exactly as the label of the same
 * relationship is. A judgement on the schema alone: it reads no row. Within a
 * table the reader may read, a rollup and a count still aggregate every
 * related record whatever the reader's row-level rule; only a lookup answers
 * to that rule, judged by the read surfaces with the rows in hand.
 */
export const relatedValuesRefusedTo = (
  app: App,
  tableName: string,
  reader: RelatedReader
): ReadonlySet<string> =>
  withDependentFormulas(
    formulaReferencesOf(app, tableName),
    new Set(
      derivedLinksOf(app, tableName, DERIVED)
        .filter((link) => !maySeeLinkSource(app, reader, link, new Set()))
        .map((link) => link.lookup)
    )
  )

/** `rows` without the named fields; a row naming none of them is returned as it is. */
export const withoutLookups = <Row extends Readonly<Record<string, unknown>>>(
  rows: readonly Row[],
  names: ReadonlySet<string>
): readonly Row[] =>
  names.size === 0
    ? rows
    : rows.map((row) =>
        Object.keys(row).some((name) => names.has(name))
          ? (Object.fromEntries(Object.entries(row).filter(([name]) => !names.has(name))) as Row)
          : row
      )
