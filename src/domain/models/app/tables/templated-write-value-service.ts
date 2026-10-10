/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A value an automation step writes comes out of a template, and a template is
 * TEXT: `{{trigger.data.priority}}` naming a key the payload did not carry
 * resolves to `''`, and `{{json trigger.data.recent}}` resolves to the text of
 * an array. Written as is, the empty string became `0` in an integer column on
 * SQLite and failed the foreign key of a relationship column, and the JSON text
 * reached a `json` column as one string rather than the structure it spells —
 * so a page repeating that column drew nothing.
 *
 * This reads each templated value as the column it lands in expects:
 *
 *  - in a number, relationship or user column, the empty (or blank) string is
 *    "no value", written as `null` — a text column keeps its `''`;
 *  - in a `json` column, text spelling an object or an array is the object or
 *    array it spells, as a client writing the records API would have sent it.
 */

/** The field types whose column holds a number or a key, where `''` is no value. */
const NULL_WHEN_EMPTY_FIELD_TYPES: ReadonlySet<string> = new Set([
  'integer',
  'decimal',
  'number',
  'currency',
  'percentage',
  'progress',
  'rating',
  'duration',
  'relationship',
  'user',
])

interface FieldShape {
  readonly name: string
  readonly type: string
}

interface TableShape {
  readonly name: string
  readonly fields: readonly FieldShape[]
}

/** Text spelling a JSON object or array, parsed; anything else, `undefined`. */
const parseStructuredJson = (value: string): unknown => {
  const trimmed = value.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return undefined
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch {
    return undefined
  }
}

/** `value` written by a template to a field of `type`, as the column expects it. */
export const templatedWriteValue = (type: string, value: unknown): unknown => {
  if (typeof value !== 'string') return value
  // eslint-disable-next-line unicorn/no-null -- SQL NULL is the stored value: `undefined` would drop the column and keep the old value
  if (NULL_WHEN_EMPTY_FIELD_TYPES.has(type) && value.trim() === '') return null
  if (type === 'json') return parseStructuredJson(value) ?? value
  return value
}

/**
 * `fields` written to `tableName` with every templated value read as its column
 * expects ({@link templatedWriteValue}). Entries naming no declared field pass
 * through untouched; the input is returned as it is when nothing changes.
 */
export const normalizeTemplatedWriteValuesIn = (
  tables: readonly TableShape[] | undefined,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const tableFields = tables?.find((table) => table.name === tableName)?.fields ?? []
  const changed = tableFields
    .filter((field) => Object.hasOwn(fields, field.name))
    .map((field) => [field.name, templatedWriteValue(field.type, fields[field.name])] as const)
    .filter(([name, value]) => value !== fields[name])
  return changed.length === 0 ? fields : { ...fields, ...Object.fromEntries(changed) }
}
