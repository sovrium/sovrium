/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sameIdSet } from '@/domain/kernel/matching/same-id-set'
import type { Table } from '@/domain/models/app'

/**
 * The field types whose column holds `''` as an ordinary value, so an empty
 * control posted for them is a real edit (clearing the text), not "untouched".
 *
 * Every other type cannot store `''` — a date, a number, a choice, a key, a
 * file — and the browser's empty sentinel for it means the reader left the
 * control alone. This mirrors the JavaScript submit path's `omitsEmptyValue`
 * (`presentation/design/field-type-behavior.ts`), which the api tier may not
 * import; a type added there with a `send` policy belongs here too.
 */
const STORES_EMPTY_STRING: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'code',
  'email',
  'phone-number',
  'json',
  'ai-categorize',
  'ai-extract',
  'ai-sentiment',
  'ai-summary',
  'ai-tag',
  'ai-translate',
  'ai-generate',
])

type TableField = Table['fields'][number]

const isEmptyFile = (value: unknown): boolean => value instanceof File && value.size === 0

/**
 * A list-valued field: a multi-select's options, or a list-valued
 * relationship's links, travel as a JSON array.
 */
const holdsList = (field: TableField): boolean =>
  field.type === 'multi-select' ||
  (field.type === 'relationship' &&
    ((field as { readonly relationType?: string }).relationType === 'many-to-many' ||
      (field as { readonly allowMultiple?: boolean }).allowMultiple === true))

const parseLinkList = (value: string): unknown => {
  if (!value.startsWith('[')) return [value]
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : [value]
  } catch {
    return [value]
  }
}

const storesEmpty = (field: TableField): boolean => {
  if (field.type === 'barcode') return ((field as { readonly format?: string }).format ?? '') === ''
  return STORES_EMPTY_STRING.has(field.type)
}

/**
 * One posted value as the write should see it: `undefined` when the control was
 * left untouched and the stored value must stay as it is.
 */
const normalizeValue = (field: TableField | undefined, value: unknown): unknown => {
  if (isEmptyFile(value)) return undefined
  if (field === undefined || typeof value !== 'string') return value
  if (value.trim() === '' && !storesEmpty(field)) return undefined
  if (holdsList(field)) return parseLinkList(value.trim())
  // A form-encoded body ends every line of a multi-line box with CRLF, whatever
  // the reader typed; the column keeps the line ends a JSON write would send.
  return value.replace(/\r\n?/g, '\n')
}

/**
 * The prefix a natively posted form marks a cleared field with: `_clear:<field>`.
 * A field name starts with a letter and holds no colon, so no column can ever
 * be named like the mark.
 */
const CLEAR_MARKER = '_clear:'

/**
 * The suffix a page drawn by an earlier version still marks a cleared field
 * with: `<field>__clear`. A field name may end in it, so it is read as a mark
 * only when no column holds that name and `<field>` is declared; a column named
 * like it always keeps its own value.
 */
const LEGACY_CLEAR_SUFFIX = '__clear'

/** Whether `key` is the old `<field>__clear` mark rather than a column. */
const isLegacyClearMark = (key: string, declared: ReadonlySet<string>): boolean =>
  key.endsWith(LEGACY_CLEAR_SUFFIX) &&
  !declared.has(key) &&
  declared.has(key.slice(0, -LEGACY_CLEAR_SUFFIX.length))

/**
 * The field names the form marked cleared: `_clear:<field>` posted non-empty,
 * or the old `<field>__clear` where it names no column. An empty mark clears
 * nothing.
 */
const clearedNames = (
  posted: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>
): readonly string[] =>
  Object.entries(posted).flatMap(([key, value]) => {
    if (typeof value !== 'string' || value === '') return []
    if (key.startsWith(CLEAR_MARKER)) return [key.slice(CLEAR_MARKER.length)]
    return isLegacyClearMark(key, declared) ? [key.slice(0, -LEGACY_CLEAR_SUFFIX.length)] : []
  })

/**
 * The prefix a natively posted edit form carries a link list's loaded ids
 * under: `_loaded:<field>`. A field name starts with a letter and holds no
 * colon, so the mark can never be a column's own name — a `<field>__loaded`
 * suffix could, and stripping it would drop that column's edit.
 */
const LOADED_MARKER = '_loaded:'

/**
 * A form-only key that names no column: a cleared mark — `_clear:*` always, the
 * old `*__clear` only where no column holds that name — or a loaded-ids mark.
 */
const isMarker = (name: string, declared: ReadonlySet<string>): boolean =>
  name.startsWith(CLEAR_MARKER) ||
  name.startsWith(LOADED_MARKER) ||
  (name.endsWith(LEGACY_CLEAR_SUFFIX) && !declared.has(name))

/**
 * Whether a posted link list still names the ids its picker was loaded with
 * (`_loaded:<field>`), whatever their order — the editor left it alone.
 *
 * The mark comes from the client, so it may only make the save SKIP a list,
 * never remove a link: a list it skips is not written at all, and every removal
 * stays the server's own reading of the stored links (`linksToClear`), which
 * keeps the links the writer cannot read. A post without the mark keeps the
 * list, so the save replaces it as before.
 */
const leftAsLoaded = (
  field: TableField | undefined,
  value: unknown,
  posted: Readonly<Record<string, unknown>>
): boolean => {
  if (field?.type !== 'relationship' || !holdsList(field) || !Array.isArray(value)) return false
  const loaded = posted[`${LOADED_MARKER}${field.name}`]
  if (typeof loaded !== 'string') return false
  const loadedIds = loaded.trim() === '' ? [] : parseLinkList(loaded.trim())
  return Array.isArray(loadedIds) && sameIdSet(value, loadedIds)
}

/**
 * The fields a natively posted update form writes.
 *
 * A form posts every control it holds, touched or not. An empty date, number,
 * choice or link is posted as `''`, which its column cannot store; a file input
 * left alone is posted as an empty file, and a list of links as the JSON its
 * picker holds. Written as posted, the first failed the whole save, the second
 * erased the stored attachment, and the third linked a record keyed by the
 * empty string after the rest of the row had already been written.
 *
 * Emptiness therefore means "untouched", and clearing is an explicit gesture:
 * the form's Clear control posts `_clear:<field>`, and that field is written
 * as `null` — which the update stores empty, and which unlinks every link of a
 * relationship list. The `null` is an ordinary value from there on, so the
 * field-level `write` permission filters it like any other. Every `_clear:*`
 * key is stripped whatever it carries: it names no column, and reaching the
 * write it would be read as one. A page drawn by an earlier version posts the
 * mark as `<field>__clear`; that key is a mark only where no column holds its
 * name — a column named like it is saved as a value and clears nothing.
 *
 * A link list still naming the ids its picker was loaded with — the form posts
 * them as `_loaded:<field>` — is left out: the save REPLACES each list it
 * writes, so writing an untouched one would take off a link made meanwhile,
 * elsewhere. Every `_loaded:*` key is stripped too. The mark can only make the
 * save leave a list out, which any post may do by not sending the list.
 */
export function normalizeFormUpdateFields(
  table: Pick<Table, 'fields'> | undefined,
  posted: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const declared = new Set((table?.fields ?? []).map((field) => field.name))
  const cleared = clearedNames(posted, declared).filter((name) => declared.has(name))
  const fieldOf = (name: string) => table?.fields.find((field) => field.name === name)
  const values = Object.fromEntries(
    Object.entries(posted)
      .filter(([name]) => !isMarker(name, declared))
      .map(([name, value]): readonly [string, unknown] => [
        name,
        normalizeValue(fieldOf(name), value),
      ])
      .filter(([name, value]) => value !== undefined && !leftAsLoaded(fieldOf(name), value, posted))
  )
  return { ...values, ...Object.fromEntries(cleared.map((name) => [name, null])) }
}
