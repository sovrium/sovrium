/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What each record-sheet control holds, and what it sends.
 *
 * Every control holds a string, as every form control does. Most hold the
 * stored value as text; five hold something else, and this module is the one
 * place that knows it:
 *
 *  - a multi-select and a multi-valued link hold their list JSON-encoded — the
 *    shape the form's checkbox group and record picker read — and send the list;
 *  - a duration holds `h:mm`, the way a person reads one, and sends seconds;
 *  - a JSON value holds its text, indented, and sends the parsed value — after
 *    {@link invalidJsonFields} has refused text that does not parse;
 *  - a cleared single link sends `null`, never an empty key.
 */

import {
  durationToSeconds,
  formatDurationValue,
  type DurationDisplayFormat,
} from '@/domain/kernel/format/duration-format'
import { fieldWidgetOf, omitsEmptyValue } from '@/presentation/design/field-type-behavior'
import { readLinkedIds } from '../parts/crud-form/record-picker-value'

export type Values = Record<string, string>

/** The parts of a sheet entry its value is read and written by. */
export interface ValueEntry {
  readonly name: string
  readonly type: string
  readonly relatedTable?: string
  readonly allowMultiple?: boolean
  readonly displayFormat?: string
}

/**
 * The storage key of an attachment as the records API reads it back —
 * `{ key, signedUrl }` — or `undefined` for any other value.
 */
const storageKeyOf = (value: unknown): string | undefined => {
  const key = (value as { readonly key?: unknown } | null | undefined)?.key
  return typeof value === 'object' && typeof key === 'string' ? key : undefined
}

/**
 * A stored value as plain text. An attachment holds its storage key — what the
 * file picker shows and the records API takes back — and a list of them the
 * JSON list of keys, never `[object Object]`.
 */
export function toFormValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const key = storageKeyOf(value)
  if (key !== undefined) return key
  if (Array.isArray(value) && value.length > 0 && value.every((entry) => storageKeyOf(entry))) {
    return JSON.stringify(value.map(storageKeyOf))
  }
  return String(value)
}

/** Whether an entry holds a LIST, sent as one: a multi-select or a multi-valued link. */
const holdsList = (entry: ValueEntry): boolean =>
  entry.type === 'multi-select' || (entry.type === 'relationship' && entry.allowMultiple === true)

/** The duration presets a person types; a decimal one still edits as `h:mm`. */
const editedDurationFormat = (entry: ValueEntry): DurationDisplayFormat =>
  entry.displayFormat === 'h:mm:ss' ? 'h:mm:ss' : 'h:mm'

/** What an entry's control holds for a stored value. */
export function toEntryFormValue(entry: ValueEntry | undefined, value: unknown): string {
  if (entry === undefined) return toFormValue(value)
  if (holdsList(entry)) {
    return Array.isArray(value) ? JSON.stringify(value.map(String)) : toFormValue(value)
  }
  if (entry.type === 'duration')
    return formatDurationValue(value, editedDurationFormat(entry)) ?? ''
  if (entry.type === 'json' && typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2)
  }
  return toFormValue(value)
}

/** A stored record as the text every control holds, read per entry. */
export function toEntryFormValues(
  record: Readonly<Record<string, unknown>>,
  entries: ReadonlyArray<ValueEntry>
): Values {
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, toEntryFormValue(byName.get(key), value)])
  )
}

/**
 * Whether a sheet still holds the record exactly as it loaded: every control
 * reads what the record's own copy reads, a missing control counting as empty.
 * Values are compared rather than change events counted, because a control
 * typed back to its loaded value is unchanged though it fired events on the way.
 * No `baseline` (a new record, or one not read yet) is never unchanged.
 */
export function holdsLoadedValues(values: Values, baseline: Values | undefined): boolean {
  if (baseline === undefined) return false
  const names = new Set([...Object.keys(values), ...Object.keys(baseline)])
  return [...names].every((name) => (values[name] ?? '') === (baseline[name] ?? ''))
}

/** Whether an entry is a single-valued link, which clears to `null`. */
const isSingleLink = (entry: ValueEntry): boolean =>
  entry.type === 'relationship' && entry.relatedTable !== undefined && entry.allowMultiple !== true

/** Text that parses as JSON, or `undefined` when it does not. */
const parsedJson = (text: string): { readonly value: unknown } | undefined => {
  try {
    return { value: JSON.parse(text) as unknown }
  } catch {
    return undefined
  }
}

/** A duration's seconds, or a JSON value parsed — `undefined` for any other type. */
function parsedWireValue(entry: ValueEntry, held: string): { readonly value: unknown } | undefined {
  const text = held.trim()
  if (entry.type === 'duration') {
    const seconds = text === '' ? undefined : durationToSeconds(text)
    if (text === '') return { value: null }
    return { value: seconds === undefined ? held : String(seconds) }
  }
  if (entry.type !== 'json') return undefined
  return { value: text === '' ? null : (parsedJson(held)?.value ?? held) }
}

/** What a text an entry holds sends, by the kind of value it is — `undefined` for plain text. */
function typedWireValue(entry: ValueEntry, held: string): { readonly value: unknown } | undefined {
  const parsed = parsedWireValue(entry, held)
  if (parsed !== undefined) return parsed
  // A blank number, date, choice or other typed column is no value at all: it
  // is written empty (`null`), never as `''`, which such a column refuses — and
  // so is a cleared single link, never an empty key.
  const blank = held.trim() === ''
  return blank && (isSingleLink(entry) || omitsEmptyValue(entry)) ? { value: null } : undefined
}

/** The value an entry sends — the inverse of {@link toEntryFormValue}. */
export function toEntryWireValue(entry: ValueEntry, values: Values): unknown {
  const held = values[entry.name] ?? ''
  if (fieldWidgetOf(entry.type) === 'file-multiple' || holdsList(entry)) {
    return readLinkedIds(held, true)
  }
  const typed = typedWireValue(entry, held)
  return typed === undefined ? held : typed.value
}

/** The JSON entries whose text does not parse — refused before anything is sent. */
export const invalidJsonFields = (
  entries: ReadonlyArray<ValueEntry>,
  values: Values
): readonly string[] =>
  entries
    .filter((entry) => entry.type === 'json')
    .filter((entry) => {
      const held = (values[entry.name] ?? '').trim()
      return held !== '' && parsedJson(held) === undefined
    })
    .map((entry) => entry.name)

/**
 * The multi-valued links an edit took a record OFF, which the records API only
 * removes when the field is first written empty: a many-to-many write ADDS the
 * links it names and never drops one it leaves out.
 */
export function droppedLinkFields(
  entries: ReadonlyArray<ValueEntry>,
  values: Values,
  record: Readonly<Record<string, unknown>>
): readonly string[] {
  return entries
    .filter((entry) => entry.type === 'relationship' && entry.allowMultiple === true)
    .filter((entry) => {
      const kept = new Set(readLinkedIds(values[entry.name] ?? '', true))
      const held = readLinkedIds(toEntryFormValue(entry, record[entry.name]), true)
      return held.some((id) => !kept.has(id))
    })
    .map((entry) => entry.name)
}
