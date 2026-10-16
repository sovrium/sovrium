/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `user` field with `allowMultiple: true` holds a LIST of account ids — a
 * crew, a project's managers — stored in a list column like a multi-select
 * (`text[]` on PostgreSQL, JSON text on SQLite). Its value keeps the order it
 * was written in and names each person once; an empty list names no one.
 *
 * Every write road calls {@link normalizeUserListValuesIn} before the value
 * reaches either engine, so the list a reader gets back is the list as written,
 * less its repeats — whichever door it came through.
 */

import { filterWithFieldLiterals } from './checkbox-literal-service'
import { normalizeDateValuesIn } from './empty-date-service'

interface FieldShape {
  readonly name: string
  readonly type: string
  readonly allowMultiple?: unknown
}

/** A field as far as telling a list of people apart reads it; a read gate's may omit `type`. */
interface LooseFieldShape {
  readonly name: string
  readonly type?: string
  readonly allowMultiple?: unknown
}

interface TableShape {
  readonly name: string
  readonly fields: readonly FieldShape[]
}

/** Whether `field` is a `user` field holding several people. */
export const isUserListField = (field: Readonly<LooseFieldShape> | undefined): boolean =>
  field !== undefined && field.type === 'user' && field.allowMultiple === true

/** The names of the fields of `fields` that hold several people. */
export const userListFieldNames = (
  fields: readonly LooseFieldShape[] | undefined
): readonly string[] =>
  (fields ?? []).filter((field) => isUserListField(field)).map((field) => field.name)

/** The entries a written list value names, before repeats are dropped. */
const entriesOf = (value: unknown): readonly unknown[] | undefined => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '') return []
  if (trimmed.startsWith('[')) {
    try {
      // @effect-diagnostics effect/preferSchemaOverJson:off
      const parsed: unknown = JSON.parse(trimmed)
      return Array.isArray(parsed) ? parsed : [value]
    } catch {
      return [value]
    }
  }
  return [value]
}

/**
 * The account ids a value written to a list field names, in the order written,
 * each once (where it first appears), blanks dropped. A lone id is a one-person
 * list. `null` and `undefined` are returned as they are; any other value is
 * returned untouched for the write to refuse.
 */
export const distinctAccountIds = (value: unknown): unknown => {
  if (value === null || value === undefined) return value
  const entries = entriesOf(value)
  if (entries === undefined) return value
  const ids = entries
    .filter(
      (entry): entry is string | number => typeof entry === 'string' || typeof entry === 'number'
    )
    .map(String)
    .filter((id) => id !== '')
  return ids.filter((id, index) => ids.indexOf(id) === index)
}

/**
 * `fields` written to `tableName` with every list of people in its stored form
 * ({@link distinctAccountIds}). Fields of other types are left as they are.
 */
export const normalizeUserListValuesIn = (
  tables: readonly TableShape[] | undefined,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const names = userListFieldNames(tables?.find((table) => table.name === tableName)?.fields)
  const present = names.filter((name) => Object.hasOwn(fields, name))
  if (present.length === 0) return fields
  return {
    ...fields,
    ...Object.fromEntries(present.map((name) => [name, distinctAccountIds(fields[name])])),
  }
}

/** The account ids a stored or written list value names, for an existence check. */
export const accountIdsOf = (value: unknown): readonly string[] => {
  const ids = distinctAccountIds(value)
  return Array.isArray(ids) ? (ids as readonly string[]) : []
}

/**
 * The operator a `contains` condition on a list of people is rewritten into:
 * list membership, never the text match `contains` means on a text column.
 * Internal — the records API vocabulary does not accept it from a caller.
 */
export const LIST_MEMBER_OPERATOR = 'holdsListMember'

/**
 * Rewrite every `contains` condition on a `user` field holding several people
 * of `fields` into a {@link LIST_MEMBER_OPERATOR} condition, through `and` /
 * `or` groups. Every other node is returned as it came.
 */
export function withListMembershipConditions<T>(
  filter: T,
  fields: readonly LooseFieldShape[] | undefined
): T {
  const listFields = new Set(userListFieldNames(fields))
  if (listFields.size === 0) return filter
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite)
    if (typeof node !== 'object' || node === null) return node
    const record = node as Readonly<Record<string, unknown>>
    if (!('operator' in record)) {
      return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, rewrite(child)]))
    }
    const { field, operator, value } = record
    const isMemberTest =
      operator === 'contains' &&
      typeof field === 'string' &&
      listFields.has(field) &&
      (typeof value === 'string' || typeof value === 'number')
    return isMemberTest ? { ...record, operator: LIST_MEMBER_OPERATOR, value: String(value) } : node
  }
  return rewrite(filter) as T
}

/**
 * A page's or a hosted form's own filter, as its read compiles it: a literal
 * read through its field's type ({@link filterWithFieldLiterals}), and
 * `contains` on a list of people as membership, as on the records API.
 */
export const readFilterOf = <F extends { readonly field: string; readonly value?: unknown }>(
  filter: readonly F[] | undefined,
  fields: readonly LooseFieldShape[] | undefined
): readonly F[] => withListMembershipConditions(filterWithFieldLiterals(filter, fields), fields)

/**
 * A stored row of `tableName` with every list of people read as a list. SQLite
 * holds the list as JSON text, and a raw row — a page render's — carries that
 * text; PostgreSQL already hands back an array, which is left as it is.
 */
export const decodeUserListValuesIn = (
  tables: readonly TableShape[] | undefined,
  tableName: string,
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const names = userListFieldNames(tables?.find((table) => table.name === tableName)?.fields)
  const encoded = names.filter((name) => typeof row[name] === 'string')
  if (encoded.length === 0) return row
  return {
    ...row,
    ...Object.fromEntries(encoded.map((name) => [name, distinctAccountIds(row[name])])),
  }
}

/**
 * `fields` written to `tableName` in their stored form: every date-like value
 * as {@link normalizeDateValuesIn} writes it, and every list of people as
 * {@link normalizeUserListValuesIn} does — the one normalisation every write
 * road applies before a value reaches either engine.
 */
export const storedValuesIn = (
  tables: readonly TableShape[] | undefined,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  normalizeUserListValuesIn(tables, tableName, normalizeDateValuesIn(tables, tableName, fields))
