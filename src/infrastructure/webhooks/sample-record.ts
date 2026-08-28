/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A minimal table-field shape needed to synthesise a sample value.
 *
 * Only `name`, `type`, and (for select fields) `options` are read — the full
 * `Field` union from the domain model carries far more, but the sample-data
 * generator depends on this narrow slice alone.
 */
export interface SampleFieldShape {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string | { readonly value?: string }>
}

/** Pick the first declared option value for a select-like field. */
const firstOption = (field: SampleFieldShape): string => {
  const opt = field.options?.[0]
  if (opt === undefined) return 'sample'
  return typeof opt === 'string' ? opt : (opt.value ?? 'sample')
}

/**
 * Static-value sample table, keyed by field `type`. Field types whose sample
 * value does not depend on the field instance resolve through this map; the
 * few that do (select, default) are handled separately in {@link sampleValueFor}.
 */
const STATIC_SAMPLE_VALUES: Readonly<Record<string, unknown>> = {
  integer: 1,
  autonumber: 1,
  count: 1,
  rating: 1,
  decimal: 0,
  currency: 0,
  percentage: 0,
  progress: 0,
  duration: 0,
  checkbox: false,
  date: new Date(0).toISOString(),
  'date-time': new Date(0).toISOString(),
  'created-at': new Date(0).toISOString(),
  'updated-at': new Date(0).toISOString(),
  'deleted-at': new Date(0).toISOString(),
  email: 'sample@example.com',
  url: 'https://example.com',
  'phone-number': '+10000000000',
  json: {},
}

/** Field types whose sample value is the first declared select option. */
const SELECT_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

/**
 * Produce a synthetic sample value for a single table field, keyed by its
 * declared `type`. Used to populate the `data.record` block of a test webhook
 * payload so receivers see a realistic shape without any real record data.
 */
const sampleValueFor = (field: SampleFieldShape): unknown => {
  if (SELECT_TYPES.has(field.type)) return firstOption(field)
  if (field.type === 'multi-select') return [firstOption(field)]
  if (field.type in STATIC_SAMPLE_VALUES) return STATIC_SAMPLE_VALUES[field.type]
  return `sample-${field.name}`
}

/**
 * Build a synthetic sample record matching a table's field structure.
 *
 * The returned object always carries an `id` plus one entry per declared
 * field, each populated with a type-appropriate placeholder value. Used by the
 * webhook test endpoint so a `webhook.test` payload mirrors the real
 * `data.record` shape without exposing actual stored data.
 *
 * @public
 */
export const buildSampleRecord = (
  fields: ReadonlyArray<SampleFieldShape>
): Readonly<Record<string, unknown>> => {
  const fieldEntries = fields.map((field) => [field.name, sampleValueFor(field)] as const)
  return { id: 1, ...Object.fromEntries(fieldEntries) }
}
