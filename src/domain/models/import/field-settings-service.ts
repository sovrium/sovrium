/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The settings a mapped field carries on top of its name and type, read from
 * the source field's options and, where the source states nothing, from its
 * values. A setting the source does not state is left out, so the field takes
 * the Sovrium default rather than a guess.
 *
 * - **Selects and statuses**: the declared choices first (Airtable's
 *   `choices`, Notion's `options`, Baserow's `select_options`), in the source's order, each with its
 *   colour when the source palette names one; then any value the records hold
 *   that no choice declares. An unnamed choice and a repeated name are dropped,
 *   since a Sovrium option is its value.
 * - **Currency**: the ISO code from the source's symbol or code, and its
 *   precision.
 * - **Rating, percentage, duration**: the scale, the precision and the display
 *   format, when the source states them in a form Sovrium has.
 * - **User**: several people per record when any record holds several.
 */

import { choiceColorOf } from './choice-colors-service'
import type { CanonicalValue } from './canonical-base'
import type { TableSourceTool } from './field-type-mappings'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/** A Sovrium config entry, as plain data. */
export type ConfigEntry = Readonly<Record<string, unknown>>

/** What a settings rule reads. */
export interface SettingsInput {
  readonly tool: TableSourceTool
  /** The source options the settings are read from: the field's, or its result's. */
  readonly options: Readonly<Record<string, unknown>> | undefined
  /** The field's value in every record, absent cells included as `undefined`. */
  readonly values: readonly (CanonicalValue | undefined)[]
}

const CURRENCY_CODES: Readonly<Record<string, string>> = { $: 'USD', '€': 'EUR', '£': 'GBP' }

const DURATION_FORMATS: ReadonlySet<string> = new Set(['h:mm', 'h:mm:ss'])

const intIn = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined

const only = (key: string, value: unknown): ConfigEntry =>
  value === undefined ? {} : { [key]: value }

/**
 * The choices a source declares: Airtable's `choices`, Notion's `options`, and
 * Baserow's `select_options`, which name a choice by its `value`.
 */
const declaredChoices = (
  input: SettingsInput
): readonly { readonly name: string; readonly color?: unknown }[] => {
  const listed =
    input.options?.['choices'] ?? input.options?.['options'] ?? input.options?.['select_options']
  return (Array.isArray(listed) ? listed : []).flatMap((choice: unknown) => {
    const { name, value, color } = (choice ?? {}) as {
      readonly name?: unknown
      readonly value?: unknown
      readonly color?: unknown
    }
    const label = name ?? value
    return typeof label === 'string' ? [{ name: label, color }] : []
  })
}

/**
 * The declared choices, then the undeclared values the records hold.
 *
 * A source tells its choices apart by id, so it may hold two with the same
 * name, or one with no name at all; a Sovrium option IS its value, so the
 * second of two equal names is dropped (the records name it the same way, so
 * they keep their value) and an empty name is dropped (its records are left
 * empty). {@link selectOptionNotes} says what was dropped.
 */
const selectOptions = (input: SettingsInput): readonly unknown[] => {
  const named = declaredChoices(input)
    .filter(
      (choice, index, all) =>
        choice.name !== '' && all.findIndex((other) => other.name === choice.name) === index
    )
    .map(({ name, color }) => {
      const hex = choiceColorOf(input.tool, color)
      return { name, option: hex === undefined ? name : { value: name, color: hex } }
    })
  const known = new Set(named.map((choice) => choice.name))
  const seen = input.values.flatMap((value) => (Array.isArray(value) ? value : [value]))
  const extra = [
    ...new Set(seen.filter((value): value is string => typeof value === 'string' && value !== '')),
  ].filter((value) => !known.has(value))
  return [...named.map((choice) => choice.option), ...extra]
}

/**
 * What {@link selectOptions} dropped from the declared choices, one sentence
 * each: an unnamed choice, and every name declared more than once.
 */
export const selectOptionNotes = (input: SettingsInput): readonly string[] => {
  const names = declaredChoices(input).map((choice) => choice.name)
  const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]
    .filter((name) => name !== '')
    .map(
      (name) =>
        `The choice "${name}" is declared more than once; it is kept once, and every record keeps it.`
    )
  return [
    ...(names.includes('')
      ? ['A choice has no name, so it was dropped; the records that held it are left empty.']
      : []),
    ...repeated,
  ]
}

const selectSettings = (input: SettingsInput): ConfigEntry => ({ options: selectOptions(input) })

const SETTINGS: Readonly<Partial<Record<FieldType, (input: SettingsInput) => ConfigEntry>>> = {
  'single-select': selectSettings,
  'multi-select': selectSettings,
  status: selectSettings,
  currency: (input) => {
    const symbol = String(input.options?.['symbol'] ?? '')
    return {
      currency: CURRENCY_CODES[symbol] ?? String(input.options?.['code'] ?? 'USD'),
      ...only('precision', intIn(input.options?.['precision'], 0, 10)),
    }
  },
  rating: (input) => only('max', intIn(input.options?.['max'], 1, 10)),
  percentage: (input) => only('precision', intIn(input.options?.['precision'], 0, 10)),
  duration: (input) => {
    const format = input.options?.['durationFormat']
    return only(
      'displayFormat',
      typeof format === 'string' && DURATION_FORMATS.has(format) ? format : undefined
    )
  },
  user: (input) =>
    input.values.some((value) => Array.isArray(value)) ? { allowMultiple: true } : {},
}

/** The settings of a field of the given type; `{}` when it needs none. */
export const fieldSettingsOf = (type: FieldType, input: SettingsInput): ConfigEntry =>
  SETTINGS[type]?.(input) ?? {}
