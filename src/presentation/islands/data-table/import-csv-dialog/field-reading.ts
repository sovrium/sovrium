/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import { normalizeHeaderText } from './parser'
import type { ImportTranslate } from './import-words'
import type { FieldMeta, FieldMetaMap } from '../../hooks/use-inline-editing'

/** The key and English words naming how a kind of field reads a CSV value. */
type Reading = readonly [key: string, english: string]

/** Each field type, by the kind of value it reads a CSV cell as. */
const READINGS: Readonly<Record<string, Reading>> = {
  integer: ['csvImport.readNumber', 'Number'],
  decimal: ['csvImport.readNumber', 'Number'],
  number: ['csvImport.readNumber', 'Number'],
  rating: ['csvImport.readNumber', 'Number'],
  progress: ['csvImport.readNumber', 'Number'],
  percentage: ['csvImport.readPercentage', 'Percentage'],
  date: ['csvImport.readDate', 'Date'],
  datetime: ['csvImport.readDateTime', 'Date and time'],
  time: ['csvImport.readTime', 'Time'],
  checkbox: ['csvImport.readCheckbox', 'Yes or no'],
  'single-select': ['csvImport.readSingleSelect', 'Single select'],
  status: ['csvImport.readSingleSelect', 'Single select'],
  'multi-select': ['csvImport.readMultiSelect', 'Multiple select'],
  email: ['csvImport.readEmail', 'Email'],
  url: ['csvImport.readUrl', 'Link'],
  'phone-number': ['csvImport.readPhone', 'Phone number'],
  relationship: ['csvImport.readRelationship', 'Linked record'],
}

/** The words naming the field a column fills: its label, else its name. */
export const fieldLabel = (field: string, fieldMeta: FieldMetaMap | undefined): string =>
  fieldMeta?.[field]?.label ?? field

/**
 * How a field reads the column it is given — `Currency · EUR` for an amount in
 * euros, `Single select` for a choice among options, `Text` for any field read
 * as written.
 */
export function fieldReading(meta: FieldMeta | undefined, t: ImportTranslate): string {
  const currency = meta?.display?.currency
  if (meta?.type === 'currency') {
    return t('csvImport.readCurrency', 'Currency · {currency}', {
      currency: typeof currency === 'string' ? currency : 'USD',
    })
  }
  const [key, english] = READINGS[meta?.type ?? ''] ?? ['csvImport.readText', 'Text']
  return t(key, english)
}

/** Whether a field takes ONE of its declared options, so a foreign value must be matched to one. */
export const isSingleChoice = (meta: FieldMeta | undefined): boolean =>
  (meta?.type === 'single-select' || meta?.type === 'status') && (meta.options?.length ?? 0) > 0

/**
 * The values of a column a single-choice field has no option for, in the
 * order the file holds them — the ones to match to an option before import.
 */
export function foreignValues(
  values: readonly string[],
  meta: FieldMeta | undefined
): readonly string[] {
  if (!isSingleChoice(meta)) return []
  const known = new Set((meta?.options ?? []).map(optionValue))
  return [...new Set(values.filter((value) => value !== '' && !known.has(value)))]
}

/**
 * The option a foreign value goes to: the one chosen for it, else the option
 * whose value it spells, else the option whose label it spells in any language
 * the app declares — case and accents aside (`signed` → `Signed`, `envoye` →
 * `Sent` labelled « Envoyé ») — else nothing.
 */
export function chosenOption(
  value: string,
  chosen: Readonly<Record<string, string>> | undefined,
  meta: FieldMeta | undefined
): string {
  const picked = chosen?.[value]
  if (picked !== undefined) return picked
  const wanted = normalizeHeaderText(value)
  const spells = (texts: readonly string[]): boolean =>
    texts.some((text) => normalizeHeaderText(text) === wanted)
  const options = meta?.options ?? []
  const match =
    options.find((option) => spells([optionValue(option)])) ??
    options.find((option) =>
      spells([optionLabel(option), ...(meta?.optionLabels?.[optionValue(option)] ?? [])])
    )
  return match === undefined ? '' : optionValue(match)
}

/**
 * The value a single-choice field stores for a CSV cell: the cell itself when
 * it is one of the field's options, else the option chosen for it, else
 * `undefined` — the field is left empty.
 */
export function storedChoice(
  value: string,
  meta: FieldMeta | undefined,
  chosen: Readonly<Record<string, string>> | undefined
): string | undefined {
  const options = (meta?.options ?? []).map(optionValue)
  if (value === '' || options.includes(value)) return value
  const option = chosenOption(value, chosen, meta)
  return option === '' ? undefined : option
}
