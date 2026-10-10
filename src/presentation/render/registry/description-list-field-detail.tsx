/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The detail of a `description-list` entry that names a `field`: the bound
 * record's value drawn BY ITS TYPE rather than as the stored text.
 *
 * A select or status reads as its option's label, on the option's own chip
 * colour (record data the author declared — never a platform hue); a date in
 * the page language (`3 Nov 2026`); a checkbox as Yes or No; and an empty value
 * as "Not set", so the row keeps its place and says the fact is missing rather
 * than collapsing as if it had never been declared.
 *
 * The value and its table arrive stamped on the entry by the page binding
 * pass (`withDescriptionFieldValues`), the hand-off `record-field` already uses.
 */

import { isEmptyCell } from '@/domain/kernel/matching/empty-value'
import { checkboxLiteralOf } from '@/domain/models/app/tables/checkbox-literal-service'
import { listValuesOf } from '@/domain/models/app/tables/record-text-service'
import { optionColor, optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import { resolveOptionChipPaint } from '@/presentation/design/option-chip-paint'
import type { Tables } from '@/domain/models/app/tables'
import type { SelectOptionLike } from '@/domain/models/app/tables/select-option'
import type { ReactElement, ReactNode } from 'react'

/** The words an empty field detail reads. */
export const NOT_SET = 'Not set'

const CHIP_CLASSES = 'inline-flex items-center rounded-sm px-1.5 text-xs font-medium'

interface FieldMeta {
  readonly type?: string
  readonly options?: readonly SelectOptionLike[]
  readonly max?: number
}

function fieldMetaOf(
  tables: Tables | undefined,
  tableName: string | undefined,
  fieldName: string
): FieldMeta | undefined {
  const table = tables?.find((candidate) => candidate.name === tableName)
  return table?.fields.find((field) => field.name === fieldName) as FieldMeta | undefined
}

/**
 * A calendar date — a year, month and day with no time — has no zone: format it
 * as written, at UTC.
 */
function formatDate(value: unknown, lang: string, withTime: boolean): string {
  const instant = new Date(String(value))
  if (Number.isNaN(instant.getTime())) return String(value)
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime
      ? { hour: '2-digit', minute: '2-digit', timeZone: parseSovriumTimezone().zoneId }
      : { timeZone: 'UTC' }),
  }).format(instant)
}

function optionChip(value: string, options: readonly SelectOptionLike[] | undefined): ReactElement {
  const option = options?.find((candidate) => optionValue(candidate) === value)
  const paint = resolveOptionChipPaint(
    option === undefined ? undefined : optionColor(option),
    undefined,
    'chip'
  )
  return (
    <span
      key={value}
      data-description-chip=""
      className={CHIP_CLASSES}
      style={paint?.style}
    >
      {option === undefined ? value : optionLabel(option)}
    </span>
  )
}

const TEXT_BY_TYPE: Readonly<Record<string, (value: unknown, lang: string) => string>> = {
  date: (value, lang) => formatDate(value, lang, false),
  datetime: (value, lang) => formatDate(value, lang, true),
  'created-at': (value, lang) => formatDate(value, lang, true),
  'updated-at': (value, lang) => formatDate(value, lang, true),
  checkbox: (value) => (checkboxLiteralOf(value) === true ? 'Yes' : 'No'),
}

/** A select or status as its chip, a multi-select as one chip per choice. */
function choiceChips(
  type: string,
  value: unknown,
  options: readonly SelectOptionLike[] | undefined
): ReactNode {
  if (type === 'single-select' || type === 'status') return optionChip(String(value), options)
  if (type === 'multi-select') return listValuesOf(value).map((entry) => optionChip(entry, options))
  return undefined
}

/** The value as text when it is an object (a user, a linked record): its name. */
const plainText = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) return String(value)
  const named = value as { readonly name?: unknown; readonly label?: unknown }
  return String(named.name ?? named.label ?? JSON.stringify(value))
}

/**
 * The detail node for one field entry, or `undefined` when the value is empty
 * (the caller then draws the "Not set" placeholder in its own empty style).
 */
export function renderFieldDetail({
  fieldName,
  value,
  tableName,
  tables,
  lang,
}: {
  readonly fieldName: string
  readonly value: unknown
  readonly tableName: string | undefined
  readonly tables: Tables | undefined
  readonly lang: string
}): ReactNode {
  // An empty list is empty in either stored shape: `[]`, or its JSON text on SQLite.
  if (isEmptyCell(value)) return undefined
  const meta = fieldMetaOf(tables, tableName, fieldName)
  const type = meta?.type ?? ''
  const chips = choiceChips(type, value, meta?.options)
  if (chips !== undefined) return chips
  if (type === 'rating') return `${String(value)} of ${String(meta?.max ?? 5)}`
  const toText = TEXT_BY_TYPE[type]
  return toText === undefined ? plainText(value) : toText(value, lang)
}
