/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record id, as every surface outside the database carries it: a string.
 *
 * The drivers decode a serial id to a number (and PostgreSQL's `bigint` to a
 * string), so a row read straight from the database and a row the records API
 * returned name the same record in two types. The records API, its webhooks,
 * its realtime events and the data an automation is triggered with all read
 * the id as a string — exact beyond 2^53, and one type whichever road the row
 * took.
 */

/** `record` with its `id`, when it has one, read as a string. */
export const withStringRecordId = <R extends Readonly<Record<string, unknown>>>(record: R): R =>
  record['id'] === undefined || record['id'] === null || typeof record['id'] === 'string'
    ? record
    : { ...record, id: String(record['id']) }

/**
 * A relationship value is a record id too — the related record's — and reads
 * as a string wherever a record is answered: the records API, webhooks,
 * realtime events and the data an automation is triggered with. A number (or a
 * PostgreSQL `bigint`) becomes its decimal string; a many-to-many list becomes
 * a list of strings; anything else (`null`, an id already a string) is kept.
 */
export const toStringRelationshipValue = (value: unknown): unknown => {
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'number' || typeof item === 'bigint')
      ? value.map((item) =>
          typeof item === 'number' || typeof item === 'bigint' ? String(item) : item
        )
      : value
  }
  return value
}

/** The names of a table's relationship fields. */
export const relationshipFieldNames = (
  table:
    { readonly fields?: readonly { readonly name: string; readonly type: string }[] } | undefined
): readonly string[] =>
  (table?.fields ?? []).filter((field) => field.type === 'relationship').map((field) => field.name)

/** `record` with each of `fieldNames` it carries read as a string relationship value. */
export const withStringRelationshipValues = (
  record: Readonly<Record<string, unknown>>,
  fieldNames: readonly string[]
): Readonly<Record<string, unknown>> => {
  const changed = fieldNames.filter(
    (name) =>
      Object.hasOwn(record, name) && toStringRelationshipValue(record[name]) !== record[name]
  )
  return changed.length === 0
    ? record
    : {
        ...record,
        ...Object.fromEntries(
          changed.map((name) => [name, toStringRelationshipValue(record[name])])
        ),
      }
}

/** The largest id a `SERIAL` (int4) key holds. */
const MAX_SERIAL_KEY = 2_147_483_647n

/** The largest id a `BIGSERIAL` (int8) key holds. */
const MAX_BIGSERIAL_KEY = 9_223_372_036_854_775_807n

/** Every spelling PostgreSQL accepts for a `uuid`: 32 hex digits, hyphens optional, braces optional. */
const UUID_SPELLING = /^\{?[0-9a-f]{4}(?:-?[0-9a-f]{4}){7}\}?$/i

/** A table's primary key, as far as the shape of its record ids depends on it. */
export type RecordKeyShape = {
  readonly primaryKey?: { readonly type?: string }
  readonly fields?: readonly { readonly name?: string }[]
}

/**
 * Whether `recordId`, taken from a URL, could name a record of `table` at all.
 *
 * A records route answers an id that names no record with 404, whatever the id
 * looks like. PostgreSQL refuses to cast `abc`, `1.5` or a 20-digit number to
 * an integer key and the refusal read as a 400 — so an id that cannot be a key
 * is answered before any query runs, exactly as a key no record holds is.
 *
 * Only the keys the engine generates are checked: the default serial key and
 * `bigserial` take a plain non-negative integer in range, `uuid` takes a UUID.
 * A `text` key takes any string, and a composite key — or a table declaring its
 * own `id` field — is left to the query, which knows its type.
 */
export const isRecordKeyShaped = (recordId: string, table: RecordKeyShape): boolean => {
  if (table.fields?.some((field) => field.name === 'id')) return true
  const keyType = table.primaryKey?.type
  if (keyType === 'uuid') return UUID_SPELLING.test(recordId)
  if (keyType === 'text' || keyType === 'composite') return true
  if (!/^\d{1,19}$/.test(recordId)) return false
  const max = keyType === 'bigserial' ? MAX_BIGSERIAL_KEY : MAX_SERIAL_KEY
  return BigInt(recordId) <= max
}
