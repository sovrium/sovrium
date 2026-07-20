/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const validateMinMaxRange = (field: {
  readonly min?: number
  readonly max?: number
}): string | undefined => {
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    return 'min cannot be greater than max'
  }
  return undefined
}

export const SelectOptionSchema = Schema.Union(
  Schema.String,
  Schema.Struct({
    value: Schema.String.pipe(Schema.nonEmptyString({ message: () => 'option value is required' })),
    label: Schema.optional(Schema.String),
  }).pipe(Schema.annotations({ title: 'Select Option (object form)' }))
).annotations({
  title: 'Select Option',
  description:
    'A select option: a bare string, or `{ value, label? }` where `label` may be a `$t:` key',
})

export type SelectOption = Schema.Schema.Type<typeof SelectOptionSchema>

export const optionValue = (option: SelectOption): string =>
  typeof option === 'string' ? option : option.value

export const optionLabel = (option: SelectOption): string =>
  typeof option === 'string' ? option : (option.label ?? option.value)

export const createOptionsSchema = (fieldType: 'single-select' | 'multi-select') =>
  Schema.Array(SelectOptionSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Options',
      message: () => `At least one option is required for ${fieldType} field`,
    }),
    Schema.filter((options) => {
      const values = options.map(optionValue)
      const uniqueValues = new Set(values)
      return (
        values.length === uniqueValues.size || 'Options must be unique (duplicate option found)'
      )
    })
  )

export const createStatusOptionsSchema = () =>
  Schema.Array(
    Schema.Struct({
      value: Schema.String.pipe(Schema.nonEmptyString({ message: () => 'value is required' })),
      color: Schema.optional(
        Schema.String.pipe(
          Schema.pattern(/^#[0-9a-fA-F]{6}$/, {
            message: () => 'Invalid color format - color must be a hex code (e.g., #3B82F6)',
          }),
          Schema.annotations({
            description: 'Hex color code for the status',
          })
        )
      ),
    }).pipe(Schema.annotations({ title: 'Status Option' }))
  ).pipe(
    Schema.minItems(1, { message: () => 'at least one option required' }),
    Schema.annotations({ title: 'Status Options' }),
    Schema.filter((options) => {
      const values = options.map((opt) => opt.value)
      const uniqueValues = new Set(values)
      return (
        values.length === uniqueValues.size || 'Options must be unique (duplicate option found)'
      )
    })
  )

export const validateButtonAction = (field: {
  readonly action: string
  readonly url?: string
  readonly automation?: string
}): string | true => {
  if (field.action === 'url' && !field.url) {
    return 'url is required when action is url'
  }
  if (field.action === 'automation' && !field.automation) {
    return 'automation is required when action is automation'
  }
  return true
}

export const findDuplicate = <T>(values: ReadonlyArray<T>): T | undefined => {
  return values.find((value, index) => values.indexOf(value) !== index)
}
