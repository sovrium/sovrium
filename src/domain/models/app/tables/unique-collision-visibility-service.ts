/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether a write refused because a `unique` value is taken may say so.
 *
 * A `unique` value is unique across the whole table, records the caller cannot
 * read included. A refusal over a taken value is therefore answered as a
 * conflict only to a caller who could read that value on every record holding
 * it — the record passes the table's read gate and its row-level read rule, and
 * the unique field itself is readable to her. Anyone else gets the refusal a
 * write out of her reach gets, which names nothing.
 *
 * The decision fails closed: a collision the write cannot place — no submitted
 * unique value, or no stored record holding one — is answered as out of reach,
 * unless the clash is between two values of the caller's own request, which
 * tells her nothing about what she may not read.
 *
 * Pure: the records holding the values are looked up by the caller of this
 * module, and each is judged with the same predicates a single-record read
 * asks.
 */

/** A value a unique column can be compared on: stored scalars only. */
export type UniqueScalar = string | number | boolean

/** The values one unique field is written with, across the request. */
export interface UniqueProbe {
  readonly field: string
  readonly values: readonly UniqueScalar[]
}

/** A stored record holding one of the probed values, as the caller may see it. */
export interface UniqueHolder {
  /** The record passes the row-level read rule for this caller. */
  readonly rowReadable: boolean
  /** The probed fields whose submitted value this record holds. */
  readonly fields: readonly string[]
}

/** The answer a refused unique write gets. */
export type UniqueCollisionAnswer = 'conflict' | 'out-of-reach'

/** The structural slice of a table declaration this module reads. */
export interface UniqueBearingTable {
  readonly fields: readonly { readonly name: string; readonly unique?: boolean }[]
  readonly unique?: readonly { readonly fields: readonly string[] }[]
  readonly indexes?: readonly {
    readonly fields: readonly string[]
    readonly unique?: boolean
  }[]
}

/**
 * Every set of fields the table holds unique: a field's own `unique`, a
 * top-level `unique` entry, and a unique index — one field or several.
 */
export const uniqueFieldSetsOf = (table: UniqueBearingTable): readonly (readonly string[])[] => [
  ...table.fields.filter((field) => field.unique === true).map((field) => [field.name]),
  ...(table.unique ?? []).map((entry) => entry.fields),
  ...(table.indexes ?? []).filter((index) => index.unique === true).map((index) => index.fields),
]

/** The fields held unique on their own — the ones a single value can collide on. */
export const singleUniqueFieldsOf = (table: UniqueBearingTable): readonly string[] => [
  ...new Set(
    uniqueFieldSetsOf(table)
      .filter((set) => set.length === 1)
      .map((set) => set[0]!)
  ),
]

/** Every field taking part in any uniqueness rule of the table. */
export const uniqueInvolvedFieldsOf = (table: UniqueBearingTable): readonly string[] => [
  ...new Set(uniqueFieldSetsOf(table).flat()),
]

const isUniqueScalar = (value: unknown): value is UniqueScalar =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

/**
 * The values each single-field unique column is written with across the
 * request's records, deduplicated; a column no record writes is left out.
 */
export const uniqueProbesOf = (
  uniqueFields: readonly string[],
  written: readonly Readonly<Record<string, unknown>>[]
): readonly UniqueProbe[] =>
  uniqueFields
    .map((field) => ({
      field,
      values: [
        ...new Map(
          written
            .map((record) => record[field])
            .filter(isUniqueScalar)
            .map((value) => [String(value), value] as const)
        ).values(),
      ],
    }))
    .filter((probe) => probe.values.length > 0)

/** Whether two records of the request write the same value into one unique column. */
export const requestRepeatsUniqueValue = (
  uniqueFields: readonly string[],
  written: readonly Readonly<Record<string, unknown>>[]
): boolean =>
  uniqueFields.some((field) => {
    const values = written
      .map((record) => record[field])
      .filter(isUniqueScalar)
      .map(String)
    return new Set(values).size < values.length
  })

/** The probed fields whose submitted value `record` holds. */
export const collidingFieldsOf = (
  record: Readonly<Record<string, unknown>>,
  probes: readonly UniqueProbe[]
): readonly string[] =>
  probes
    .filter((probe) => {
      const stored = record[probe.field]
      return (
        isUniqueScalar(stored) && probe.values.some((value) => String(value) === String(stored))
      )
    })
    .map((probe) => probe.field)

/**
 * Whether the stored records holding the values must be looked up before the
 * answer can be given. They need not be when the caller reads every record of
 * the table and every field taking part in its uniqueness rules: then nothing
 * the conflict could point at is hidden from her.
 */
export const uniqueCollisionNeedsHolders = (input: {
  readonly rowScoped: boolean
  readonly involvedFields: readonly string[]
  readonly fieldReadable: (field: string) => boolean
}): boolean => input.rowScoped || !input.involvedFields.every(input.fieldReadable)

/**
 * The answer to a write refused because a unique value is taken.
 *
 * - A caller who reads every record and every field keeps the conflict.
 * - A caller who may not read the table gets the out-of-reach refusal.
 * - With no lookup needed (`holders` absent), the conflict stands.
 * - With no submitted unique value to look up, or no stored record holding
 *   one, the collision cannot be placed: out of reach, unless the request
 *   itself repeats a unique value.
 * - Otherwise the conflict stands only when every holder passes the row-level
 *   read rule and every field it collides on is readable to the caller.
 */
export const decideUniqueCollisionAnswer = (input: {
  readonly callerReadsEverything: boolean
  readonly tableReadable: boolean
  readonly probes: readonly UniqueProbe[]
  readonly fieldReadable: (field: string) => boolean
  readonly holders: readonly UniqueHolder[] | undefined
  readonly requestRepeats: boolean
}): UniqueCollisionAnswer => {
  if (input.callerReadsEverything) return 'conflict'
  if (!input.tableReadable) return 'out-of-reach'
  const { holders } = input
  if (holders === undefined) return 'conflict'
  if (input.probes.length === 0 || holders.length === 0) {
    return input.requestRepeats ? 'conflict' : 'out-of-reach'
  }
  return holders.every((holder) => holder.rowReadable && holder.fields.every(input.fieldReadable))
    ? 'conflict'
    : 'out-of-reach'
}
