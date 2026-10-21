/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a select, a multi-select or a status becomes once its choices are
 * cleaned by `field-settings-service`.
 *
 * A source tells its choices apart by id, so it may hold two with the same
 * name, one with no name, or none at all. A Sovrium option IS its value, so
 * the repeated and the unnamed ones are dropped and reported, and a select
 * left with nothing to choose becomes a text field, since Sovrium refuses a
 * select with no option.
 */

import { fieldSettingsOf, selectOptionNotes, type SettingsInput } from './field-settings-service'
import type { FieldTypeLookup } from './field-type-mappings'
import type { FieldType } from '@/domain/models/app/tables/fields/field'

/** The field types whose settings are a list of options. */
const SELECTS: ReadonlySet<FieldType> = new Set<FieldType>([
  'single-select',
  'multi-select',
  'status',
])

/** Whether a field type's settings are a list of options. */
export const isSelectType = (type: FieldType): boolean => SELECTS.has(type)

/** What one select becomes: the shape of a field decision. */
export interface SelectDecision {
  readonly type: FieldType
  readonly settings: Readonly<Record<string, unknown>>
  readonly outcome: 'mapped' | 'degraded' | 'unmapped'
  readonly reason?: string
  readonly seeded: true
}

/** Decide what a select of the given looked-up type becomes, over its source options and values. */
export const decideSelect = (looked: FieldTypeLookup, input: SettingsInput): SelectDecision => {
  const settings = fieldSettingsOf(looked.sovrium, input)
  const { options } = settings
  if (Array.isArray(options) && options.length === 0) {
    return {
      type: 'single-line-text',
      settings: {},
      outcome: 'degraded',
      reason: `The source declares no choice for this ${looked.sovrium} and no record holds one, so it is kept as text.`,
      seeded: true,
    }
  }
  const reasons = [
    ...(looked.outcome === 'degraded' ? [looked.reason] : []),
    ...selectOptionNotes(input),
  ]
  return {
    type: looked.sovrium,
    settings,
    outcome: reasons.length === 0 ? looked.outcome : 'degraded',
    ...(reasons.length === 0 ? {} : { reason: reasons.join(' ') }),
    seeded: true,
  }
}
