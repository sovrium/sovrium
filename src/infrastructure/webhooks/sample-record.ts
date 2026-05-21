/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export interface SampleFieldShape {
  readonly name: string
  readonly type: string
  readonly options?: ReadonlyArray<string | { readonly value?: string }>
}

const firstOption = (field: SampleFieldShape): string => {
  const opt = field.options?.[0]
  if (opt === undefined) return 'sample'
  return typeof opt === 'string' ? opt : (opt.value ?? 'sample')
}

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

const SELECT_TYPES: ReadonlySet<string> = new Set(['single-select', 'status'])

const sampleValueFor = (field: SampleFieldShape): unknown => {
  if (SELECT_TYPES.has(field.type)) return firstOption(field)
  if (field.type === 'multi-select') return [firstOption(field)]
  if (field.type in STATIC_SAMPLE_VALUES) return STATIC_SAMPLE_VALUES[field.type]
  return `sample-${field.name}`
}

export const buildSampleRecord = (
  fields: ReadonlyArray<SampleFieldShape>
): Record<string, unknown> => {
  const fieldEntries = fields.map((field) => [field.name, sampleValueFor(field)] as const)
  return { id: 1, ...Object.fromEntries(fieldEntries) }
}
