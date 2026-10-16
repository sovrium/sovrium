/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The name a record goes by when nobody wrote one: its first text field
 * holding a value, in the order the table declares its fields, else its id.
 *
 * A record sheet with no `title` heads itself with this, and a list of linked
 * records names each one by it, so the two never disagree about what a record
 * is called.
 *
 * ─── WHICH FIELDS COUNT AS TEXT ─────────────────────────────────────────────
 *
 * The types a person writes a name into: a line of text, an email, a web
 * address, a phone number. A paragraph is left out — long text is a note about
 * the record, not its name — and so are rich text, whose value is markup a
 * heading would print as tags, and a write-only field, whose value no reader is
 * ever shown. A value spread over lines contributes its first.
 */

import { declaresWriteOnly } from './write-only-field-service'

/** Field types whose value can name a record. */
export const RECORD_TITLE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'email',
  'url',
  'phone-number',
])

/** The parts of a field this module reads. */
export interface TitleCandidateField {
  readonly name: string
  readonly type: string
}

/** The fields, in declared order, whose value may name a record. */
export const recordTitleFields = (
  fields: readonly TitleCandidateField[] | undefined
): readonly string[] =>
  (fields ?? [])
    .filter((field) => RECORD_TITLE_FIELD_TYPES.has(field.type) && !declaresWriteOnly(field))
    .map((field) => field.name)

/** A value's first non-blank line, or `undefined` when it holds no text. */
const firstLineOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const line = String(value)
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '')
  return line === undefined || line === '' ? undefined : line
}

/**
 * What a record is called: the first title field holding a value, else its
 * `id`, else the empty string for a record that has neither (one the sheet has
 * not loaded yet).
 */
export const recordTitleOf = (
  fields: readonly TitleCandidateField[] | undefined,
  record: Readonly<Record<string, unknown>>
): string => {
  const named = recordTitleFields(fields)
    .map((name) => firstLineOf(record[name]))
    .find((line) => line !== undefined)
  if (named !== undefined) return named
  const { id } = record
  return id === undefined || id === null ? '' : String(id)
}
