/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Notion property values as canonical values: one function per value shape the
 * API version the fetch pins serves in a page, pinned under
 * `[internal ref]` (facts e1 to f6).
 *
 * Every value is `{ id, type, <type>: … }`; the functions here read the
 * `<type>` member.
 *
 * - **Title and rich text** are arrays of rich-text runs: their `plain_text`
 *   is kept, joined. Annotations and mentions are dropped (the mapping table
 *   says so).
 * - **Select and status** keep the option's name; a **multi-select** the list
 *   of names.
 * - A **date** keeps its `start`; a range's `end` is dropped.
 * - **People** become user references when Notion shared their email, which it
 *   does only when the connection may read users' email addresses. A partial
 *   user (`{ object, id }`), a bot or a group has none and is left out.
 * - **Files** become references to what the fetch downloaded, found through
 *   the fetch's attachment index by {@link notionAssetKey}. An external file
 *   (a link to another site) is never downloaded, so it holds no asset.
 * - A **relation** is a list of page ids of the data source the schema names.
 * - A **formula** keeps the value Notion last computed, of the type it states;
 *   a **rollup** too, a list rollup as the text of its items.
 * - A **unique id** keeps its number, without its prefix; a **verification**
 *   its state; a **place** its name, address and coordinates as text.
 * - A **button** holds nothing: the API exposes neither its actions nor a way
 *   to press it.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import type { CanonicalValue } from './canonical-base'
import type { SnapshotAsset } from './snapshot-manifest'

/** One downloaded file, as the fetch's attachment index records it. */
export type NotionAsset = SnapshotAsset

/** What a value function reads besides the value. */
export interface NotionCellContext {
  /** The page the value belongs to. */
  readonly pageId: string
  /** For a relation: the id of the data source it points at. */
  readonly target?: string
  /** The downloaded files, by {@link notionAssetKey}. */
  readonly assets: ReadonlyMap<string, NotionAsset>
}

/** A Notion user with the email the API shared, the way a collaborator is seeded. */
export interface NotionPerson {
  readonly email: string
  readonly name?: string
}

type Item = Exclude<CanonicalValue, readonly unknown[]>
type Read = (
  value: unknown,
  context: NotionCellContext,
  propertyId: string
) => CanonicalValue | undefined

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const EMAIL = /^[^\s@]+@[^\s@]+$/

/**
 * The key a file of a page property is downloaded under: the page, the
 * property and the file's position. Notion files carry no id, and their URL
 * changes on every read, so the position is the stable name.
 */
export const notionAssetKey = (pageId: string, propertyId: string, index: number): string =>
  `${pageId}:${propertyId}:${String(index)}`

/**
 * The file-name key of a property id. Notion ids are URL-encoded and may hold
 * `%`, `[` or `\\`; their hex spelling is safe in any path.
 */
export const notionPropertyFileKey = (propertyId: string): string =>
  [...new TextEncoder().encode(propertyId)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

/** The property id a {@link notionPropertyFileKey} spells, or `undefined`. */
export const notionPropertyOfFileKey = (key: string): string | undefined => {
  if (key.length === 0 || key.length % 2 !== 0 || !/^[0-9a-f]+$/.test(key)) return undefined
  const bytes = Uint8Array.from(key.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
  return new TextDecoder().decode(bytes)
}

/** The person a Notion user object names, when Notion shared their email. */
export const notionPersonOf = (user: unknown): NotionPerson | undefined => {
  if (!isRecord(user)) return undefined
  const person = isRecord(user['person']) ? user['person'] : undefined
  const email = person?.['email']
  if (typeof email !== 'string' || !EMAIL.test(email)) return undefined
  const { name } = user
  return typeof name === 'string' && name !== '' ? { email, name } : { email }
}

/** Rich-text runs as their plain text, or nothing when empty. */
const text = (value: unknown): CanonicalValue | undefined => {
  const joined = listOf(value)
    .map((run) => (isRecord(run) && typeof run['plain_text'] === 'string' ? run['plain_text'] : ''))
    .join('')
  return joined === '' ? undefined : joined
}

const scalar = (value: unknown): CanonicalValue | undefined => {
  if (typeof value === 'string') return value === '' ? undefined : value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  return typeof value === 'boolean' ? value : undefined
}

const named = (value: unknown): CanonicalValue | undefined =>
  isRecord(value) && typeof value['name'] === 'string' ? value['name'] : undefined

const names = (value: unknown): CanonicalValue | undefined => {
  const list = listOf(value).flatMap((option) => {
    const name = named(option)
    return typeof name === 'string' ? [name] : []
  })
  return list.length === 0 ? undefined : list
}

const date = (value: unknown): CanonicalValue | undefined =>
  isRecord(value) && typeof value['start'] === 'string' ? value['start'] : undefined

const userRef = (user: unknown): Item | undefined => {
  const person = notionPersonOf(user)
  return person === undefined ? undefined : { kind: 'user', email: person.email }
}

const people = (value: unknown): CanonicalValue | undefined => {
  const refs = listOf(value).flatMap((user) => {
    const ref = userRef(user)
    return ref === undefined ? [] : [ref]
  })
  return refs.length === 0 ? undefined : refs
}

const files: Read = (value, context, propertyId) => {
  const list = listOf(value).flatMap((file, index): readonly Item[] => {
    if (!isRecord(file) || typeof file['name'] !== 'string') return []
    const held = context.assets.get(notionAssetKey(context.pageId, propertyId, index))
    const asset = held?.asset
    return [
      { kind: 'attachment', filename: file['name'], ...(asset === undefined ? {} : { asset }) },
    ]
  })
  return list.length === 0 ? undefined : list
}

const relation: Read = (value, context) => {
  const { target } = context
  if (target === undefined) return undefined
  const refs = listOf(value).flatMap((page) =>
    isRecord(page) && typeof page['id'] === 'string'
      ? [{ kind: 'link' as const, table: target, record: page['id'] }]
      : []
  )
  return refs.length === 0 ? undefined : refs
}

/** A computed value `{ type, <type>: … }`: the member its type names. */
const typed = (value: unknown, context: NotionCellContext): CanonicalValue | undefined => {
  if (!isRecord(value) || typeof value['type'] !== 'string') return undefined
  const member = value[value['type']]
  if (value['type'] === 'date') return date(member)
  if (value['type'] === 'array') {
    const items = listOf(member).flatMap((item) => {
      const one = notionCell(item, context)
      return one === undefined ? [] : [Array.isArray(one) ? one.join(', ') : String(one)]
    })
    return items.length === 0 ? undefined : items.join(', ')
  }
  return scalar(member)
}

const uniqueId = (value: unknown): CanonicalValue | undefined =>
  isRecord(value) ? scalar(value['number']) : undefined

const verification = (value: unknown): CanonicalValue | undefined =>
  isRecord(value) ? scalar(value['state']) : undefined

const place = (value: unknown): CanonicalValue | undefined => {
  if (!isRecord(value)) return undefined
  const label = [value['name'], value['address']]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(', ')
  const at =
    typeof value['lat'] === 'number' && typeof value['lon'] === 'number'
      ? `${String(value['lat'])}, ${String(value['lon'])}`
      : ''
  const joined = [label, at === '' ? '' : `(${at})`].filter((part) => part !== '').join(' ')
  return joined === '' ? undefined : joined
}

/** The value functions, by Notion property type; every other type is read as a scalar. */
const CELLS: Readonly<Record<string, Read>> = {
  title: text,
  rich_text: text,
  select: named,
  status: named,
  multi_select: names,
  date,
  people,
  created_by: (value) => userRef(value),
  last_edited_by: (value) => userRef(value),
  files,
  relation,
  formula: (value, context) => typed(value, context),
  rollup: (value, context) => typed(value, context),
  unique_id: uniqueId,
  verification,
  place,
  button: () => undefined,
}

/**
 * One Notion property value (`{ id, type, <type>: … }`) as a canonical value,
 * or `undefined` when it holds nothing.
 */
export const notionCell = (
  property: unknown,
  context: NotionCellContext
): CanonicalValue | undefined => {
  if (!isRecord(property) || typeof property['type'] !== 'string') return undefined
  const { type } = property
  const value = property[type]
  if (value === null || value === undefined) return undefined
  const read = CELLS[type]
  const id = typeof property['id'] === 'string' ? property['id'] : type
  return read === undefined ? scalar(value) : read(value, context, id)
}
