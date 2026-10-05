/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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

/** A list-valued relationship: its links travel as a JSON array of keys. */
const holdsLinkList = (field: TableField): boolean =>
  field.type === 'relationship' &&
  ((field as { readonly relationType?: string }).relationType === 'many-to-many' ||
    (field as { readonly allowMultiple?: boolean }).allowMultiple === true)

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
  if (holdsLinkList(field)) return parseLinkList(value.trim())
  return value
}

/** The suffix a natively posted form marks a cleared field with: `<field>__clear`. */
const CLEAR_MARKER = '__clear'

/** The field names the form marked cleared (`<field>__clear` posted non-empty). */
const clearedNames = (posted: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.entries(posted).flatMap(([key, value]) =>
    key.endsWith(CLEAR_MARKER) && typeof value === 'string' && value !== ''
      ? [key.slice(0, -CLEAR_MARKER.length)]
      : []
  )

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
 * the form's Clear control posts `<field>__clear`, and that field is written
 * as `null` — which the update stores empty, and which unlinks every link of a
 * relationship list. Every `*__clear` key is stripped whatever it carries: it
 * names no column, and reaching the write it would be read as one.
 */
export function normalizeFormUpdateFields(
  table: Pick<Table, 'fields'> | undefined,
  posted: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const declared = new Set((table?.fields ?? []).map((field) => field.name))
  const cleared = clearedNames(posted).filter((name) => declared.has(name))
  const values = Object.fromEntries(
    Object.entries(posted)
      .filter(([name]) => !name.endsWith(CLEAR_MARKER))
      .map(([name, value]): readonly [string, unknown] => [
        name,
        normalizeValue(
          table?.fields.find((field) => field.name === name),
          value
        ),
      ])
      .filter(([, value]) => value !== undefined)
  )
  // eslint-disable-next-line unicorn/no-null -- `null` is the records API's "store this field empty".
  return { ...values, ...Object.fromEntries(cleared.map((name) => [name, null])) }
}
