/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Report fields whose `id` is left to be assigned by position.
 *
 * A field `id` is optional in config. When it is omitted the decoder fills it
 * in from the field's ARRAY POSITION, so the identity exists whether or not the
 * author wrote it — and the author cannot see it. The migration engine diffs
 * tables BY id, so inserting a field anywhere but the end shifts every id after
 * it and manufactures a rename cascade between fields nobody renamed.
 *
 * Nobody writes that by hand. An AI asked to "add a field before status" writes
 * it every time, which is why this exists now rather than when ids were added.
 *
 * ### Why a notice and not a refusal
 *
 * The config is VALID and ships. Refusing would break every config written
 * before ids were explicit, in exchange for no behaviour change at all on the
 * configs that never insert a field — the cost falls entirely on people who are
 * not experiencing the problem.
 *
 * ### Why it reads the RAW config
 *
 * By the time `AppSchema` has decoded, every field carries an id and the
 * distinction this reports has been erased. The question is only answerable of
 * the document as the author wrote it.
 */

/** Fields named on one line before the list is summarised. */
const MAX_NAMED_FIELDS = 5

/**
 * The greppable token every one of these notices carries.
 *
 * Exported because a second reader now cites it: the stdio config write tool
 * REFUSES the insert this notice only warns about, and an operator grepping for
 * why must land on one vocabulary rather than two.
 *
 * @public
 */
export const IMPLICIT_FIELD_ID_TOKEN = 'field-id-implicit'

const NOTICE_TOKEN = IMPLICIT_FIELD_ID_TOKEN

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** How a field with no `name` is referred to — by the position that IS its id. */
const fieldLabel = (field: Readonly<Record<string, unknown>>, index: number): string =>
  typeof field.name === 'string' && field.name.length > 0
    ? `"${field.name}"`
    : `the field at position ${index + 1}`

/** Names of the fields on one table that declare no `id`, in declaration order. */
const fieldsWithoutIds = (table: Readonly<Record<string, unknown>>): readonly string[] => {
  const { fields } = table
  if (!Array.isArray(fields)) return []
  return fields.flatMap((field, index) =>
    isRecord(field) && field.id === undefined ? [fieldLabel(field, index)] : []
  )
}

/** `a, b and 3 more`, so a wide table does not print an unreadable wall. */
const summariseFields = (labels: readonly string[]): string => {
  const named = labels.slice(0, MAX_NAMED_FIELDS).join(', ')
  const remaining = labels.length - MAX_NAMED_FIELDS
  return remaining > 0 ? `${named} and ${remaining} more` : named
}

/**
 * One notice per table that leaves any field id implicit.
 *
 * Per TABLE rather than per field: a table written before ids existed omits
 * every one of them, and forty identical lines about one table teach their
 * reader to ignore notices. The table is named because "some field somewhere
 * has no id" is not actionable in a config split across a dozen `$ref` files.
 *
 * @param parsed - The config object as parsed, BEFORE `AppSchema` decodes it
 * @public
 */
export const collectImplicitFieldIdNotices = (parsed: unknown): readonly string[] => {
  if (!isRecord(parsed)) return []
  const { tables } = parsed
  if (!Array.isArray(tables)) return []

  return tables.flatMap((table, index) => {
    if (!isRecord(table)) return []
    const missing = fieldsWithoutIds(table)
    if (missing.length === 0) return []

    const tableLabel =
      typeof table.name === 'string' && table.name.length > 0
        ? `"${table.name}"`
        : `the table at position ${index + 1}`

    return [
      `${NOTICE_TOKEN}: table ${tableLabel} — ${summariseFields(missing)} ` +
        `${missing.length === 1 ? 'declares' : 'declare'} no id, so the id is the field's ` +
        `position in the list. Inserting a field above one of them shifts every id after ` +
        `it, and the migration diff reads that as a rename. Give each field an explicit ` +
        `id — keep the ones it has today, and give new fields the next unused number.`,
    ]
  })
}

// ---------------------------------------------------------------------------
// The same question asked of a CHANGE rather than of a document
// ---------------------------------------------------------------------------

/** Every `tables[]` entry of a parsed config, or an empty list. */
const tablesOf = (parsed: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (!isRecord(parsed)) return []
  const { tables } = parsed
  return Array.isArray(tables) ? tables.filter((table) => isRecord(table)) : []
}

/** Field names in declaration order — the sequence positional ids are read off. */
const fieldNames = (table: Readonly<Record<string, unknown>>): readonly string[] => {
  const { fields } = table
  if (!Array.isArray(fields)) return []
  return fields.map((field, index) =>
    isRecord(field) && typeof field.name === 'string' ? field.name : `#${String(index)}`
  )
}

const tableName = (table: Readonly<Record<string, unknown>>): string =>
  typeof table.name === 'string' ? table.name : ''

/**
 * Whether one field sequence is the other with entries added or removed only at
 * the END — the precise reading of "nothing moves".
 *
 * A pure append is safe because every existing field keeps its position, and so
 * keeps the id that position IS. Anything else — an insert, a reorder, a removal
 * from the middle — shifts at least one field, and the migration diff reads that
 * shift as a rename of fields nobody renamed.
 */
const nothingMoved = (before: readonly string[], after: readonly string[]): boolean => {
  const shared = Math.min(before.length, after.length)
  return before.slice(0, shared).every((name, index) => name === after[index])
}

/**
 * Tables whose fields carry no explicit `id` AND whose candidate field list
 * moves one of them.
 *
 * Asked of a CHANGE, which is what makes it a refusal where
 * {@link collectImplicitFieldIdNotices} is only a notice. A document that leaves
 * ids implicit is valid and ships; an EDIT that inserts a field above one of
 * them silently renumbers every field after it and re-points the data behind
 * them, and no amount of decoding can see that — by the time `AppSchema` has
 * run, both documents carry a full set of ids and the two are indistinguishable.
 *
 * A table the candidate INTRODUCES is never reported: there are no existing
 * positions for an insert to shift.
 *
 * Both arguments are the `$ref`-RESOLVED configs as PARSED, for the reason the
 * header gives — the distinction is erased by the decode.
 *
 * @param currentParsed - The config as it stands on disk
 * @param candidateParsed - The config the write would leave behind
 * @returns The names of the tables that would renumber, in candidate order
 * @public
 */
export const findImplicitFieldIdShifts = (
  currentParsed: unknown,
  candidateParsed: unknown
): readonly string[] => {
  const before = new Map(tablesOf(currentParsed).map((table) => [tableName(table), table]))

  return tablesOf(candidateParsed).flatMap((candidate) => {
    if (fieldsWithoutIds(candidate).length === 0) return []
    const existing = before.get(tableName(candidate))
    if (existing === undefined) return []
    return nothingMoved(fieldNames(existing), fieldNames(candidate)) ? [] : [tableName(candidate)]
  })
}
