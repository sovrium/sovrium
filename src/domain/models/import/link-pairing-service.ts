/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shape of each link field: how many records it holds, which field on the
 * other table answers it, and which of the two stores the link.
 *
 * ## One vs many: the schema first, then the data
 *
 * A source states a link's target table and, when the link is two-way, the
 * paired field on that table. Most sources also state whether the link holds
 * one record or several (Airtable's `prefersSingleRecordLink`, Baserow's
 * `link_row_multiple_relationships`, Zite's `allowMultiple`, Webflow's
 * `Reference` and `MultiReference`, a database foreign key), and that
 * declaration wins: a link declared to hold several is "to many" even when no
 * record holds more than one yet. The records only refine it: a link whose
 * source states nothing is "to many" when one record holds more than one
 * linked record, and so is a link declared single that a record nonetheless
 * fills with several, so that no link is lost.
 *
 * ## One side stores, the other reads
 *
 * A two-way source link is two fields that list the same pairs from both ends.
 * In Sovrium the pair is ONE relationship read from both sides, so one field
 * stores it and the other is derived from it:
 *
 * | This side | Other side | This side becomes                      | Other side becomes         |
 * | --------- | ---------- | -------------------------------------- | -------------------------- |
 * | to one    | to many    | `many-to-one`, it stores               | `one-to-many`, it reads    |
 * | to many   | to many    | `many-to-many`, it stores              | `many-to-many`, it reads   |
 * | to one    | to one     | the side the source prefers single     | `one-to-many`, it reads    |
 *
 * When neither side holds more than one record, the side the source marks as
 * preferring a single record (Airtable's `prefersSingleRecordLink`) stores the
 * link; when that does not decide, the field met first does. A derived side
 * writes no seed value: its links are the stored side's, read back.
 */

import type { CanonicalBase, CanonicalField, CanonicalTable } from './canonical-base'

/** The Sovrium shape of one link field. */
export interface LinkShape {
  readonly relationType: 'many-to-one' | 'one-to-many' | 'many-to-many'
  /** The key ({@link linkKey}) of the paired field, for a two-way link. */
  readonly reciprocal?: string
  /** True for the side that reads the pair rather than storing it. */
  readonly derived: boolean
}

/** A field's key across the whole base: its table's source id, then its own. */
export const linkKey = (table: string, field: string): string => `${table}\u0000${field}`

/** The option keys a source names a link's target table with: Airtable's, Notion's. */
const TARGET_KEYS = ['linkedTableId', 'data_source_id'] as const

const optionOf = (field: CanonicalField, keys: readonly string[]): string | undefined =>
  keys
    .map((key) => field.options?.[key])
    .find((value): value is string => typeof value === 'string')

/** The source id of the table a link field points at. */
export const linkTargetOf = (field: CanonicalField): string | undefined =>
  optionOf(field, TARGET_KEYS)

/** The paired field of a two-way link: Airtable's `inverseLinkFieldId`, Notion's synced property. */
const inverseOf = (field: CanonicalField): string | undefined => {
  const dual = field.options?.['dual_property']
  const synced =
    typeof dual === 'object' && dual !== null
      ? (dual as Readonly<Record<string, unknown>>)['synced_property_id']
      : undefined
  return (
    optionOf(field, ['inverseLinkFieldId']) ?? (typeof synced === 'string' ? synced : undefined)
  )
}

interface LinkField {
  readonly key: string
  readonly table: CanonicalTable
  readonly field: CanonicalField
  readonly order: number
}

/** The source link types that state their multiplicity by themselves. */
const DECLARED_BY_TYPE: Readonly<Record<string, boolean>> = {
  MultiReference: true,
  Reference: false,
  'FOREIGN KEY': false,
}

/** What the source's schema says a link holds: `true` for several, `undefined` when it is silent. */
const declaredMany = (field: CanonicalField): boolean | undefined => {
  const flag = (key: string): boolean | undefined => {
    const value = field.options?.[key]
    return typeof value === 'boolean' ? value : undefined
  }
  const single = flag('prefersSingleRecordLink')
  if (single !== undefined) return !single
  const many = flag('link_row_multiple_relationships') ?? flag('allowMultiple')
  if (many !== undefined) return many
  return DECLARED_BY_TYPE[field.sourceType]
}

const recordsHoldMany = ({ table, field }: LinkField): boolean =>
  table.records.some((record) => {
    const value = record.values[field.sourceId]
    return Array.isArray(value) && value.length > 1
  })

/** Declared to hold several, or found holding several in a record. */
const holdsMany = (link: LinkField): boolean =>
  declaredMany(link.field) === true || recordsHoldMany(link)

const prefersSingle = ({ field }: LinkField): boolean =>
  field.options?.['prefersSingleRecordLink'] === true

/** Which of a two-way pair stores the link. */
const storerOf = (first: LinkField, second: LinkField): LinkField => {
  const firstMany = holdsMany(first)
  const secondMany = holdsMany(second)
  if (firstMany !== secondMany) return firstMany ? second : first
  return !firstMany && prefersSingle(second) && !prefersSingle(first) ? second : first
}

const pairShapes = (
  first: LinkField,
  second: LinkField
): readonly (readonly [string, LinkShape])[] => {
  const storer = storerOf(first, second)
  const reader = storer === first ? second : first
  const many = holdsMany(storer)
  return [
    [
      storer.key,
      {
        relationType: many ? 'many-to-many' : 'many-to-one',
        reciprocal: reader.key,
        derived: false,
      },
    ],
    [
      reader.key,
      {
        relationType: many ? 'many-to-many' : 'one-to-many',
        reciprocal: storer.key,
        derived: true,
      },
    ],
  ]
}

/**
 * The shape of every link field of a base, by {@link linkKey}.
 *
 * @param isLink - whether a field is a link, by its source type.
 */
export const pairLinks = (
  base: CanonicalBase,
  isLink: (field: CanonicalField) => boolean
): ReadonlyMap<string, LinkShape> => {
  const tableIds = new Set(base.tables.map((table) => table.sourceId))
  const links = base.tables
    .flatMap((table) => table.fields.map((field) => ({ table, field })))
    .filter(({ field }) => isLink(field) && tableIds.has(linkTargetOf(field) ?? ''))
    .map(({ table, field }, order) => ({
      key: linkKey(table.sourceId, field.sourceId),
      table,
      field,
      order,
    }))
  const byKey = new Map(links.map((link) => [link.key, link] as const))
  const partnerOf = (link: LinkField): LinkField | undefined => {
    const inverse = inverseOf(link.field)
    const partner =
      inverse === undefined
        ? undefined
        : byKey.get(linkKey(linkTargetOf(link.field) ?? '', inverse))
    return partner !== undefined && partner.key !== link.key ? partner : undefined
  }
  return new Map(
    links.flatMap((link): readonly (readonly [string, LinkShape])[] => {
      const partner = partnerOf(link)
      if (partner === undefined) {
        return [
          [
            link.key,
            { relationType: holdsMany(link) ? 'many-to-many' : 'many-to-one', derived: false },
          ],
        ]
      }
      const [first, second] = link.order < partner.order ? [link, partner] : [partner, link]
      return pairShapes(first, second).filter(([key]) => key === link.key)
    })
  )
}
