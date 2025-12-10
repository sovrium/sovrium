/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Validates that min is less than or equal to max when both are specified.
 *
 * This validation is used by numeric field types (integer, decimal, currency, percentage)
 * to ensure that range constraints are logically valid. Returns an error message if
 * validation fails, or undefined if validation passes.
 *
 * @param field - Object containing optional min and max properties
 * @returns Error message if min > max, undefined otherwise
 *
 * @example
 * ```typescript
 * validateMinMaxRange({ min: 0, max: 100 })  // undefined (valid)
 * validateMinMaxRange({ min: 100, max: 10 }) // 'min cannot be greater than max'
 * validateMinMaxRange({ min: 0 })            // undefined (only min specified)
 * validateMinMaxRange({ max: 100 })          // undefined (only max specified)
 * ```
 */
export const validateMinMaxRange = (field: {
  readonly min?: number
  readonly max?: number
}): string | undefined => {
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    return 'min cannot be greater than max'
  }
  return undefined
}

/**
 * Creates a reusable options array schema for select-type fields.
 *
 * This schema factory is used by single-select and multi-select field types
 * to ensure consistent validation of options arrays. All select fields require
 * at least one option to be meaningful, and option values must be unique.
 *
 * @param fieldType - The type of select field (for error messages)
 * @returns Effect Schema for validating options arrays
 *
 * @example
 * ```typescript
 * // Used in single-select field
 * const optionsSchema = createOptionsSchema('single-select')
 * // Used in multi-select field
 * const optionsSchema = createOptionsSchema('multi-select')
 * ```
 */
export const createOptionsSchema = (fieldType: 'single-select' | 'multi-select') =>
  Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      message: () => `At least one option is required for ${fieldType} field`,
    }),
    Schema.filter((options) => {
      const uniqueOptions = new Set(options)
      return options.length === uniqueOptions.size || 'Options must be unique (duplicate option found)'
    })
  )

/**
 * Validates that button fields have required properties based on their action type.
 *
 * This validation is used by button field types to ensure that action-specific
 * properties are provided when needed. For example, buttons with action='url'
 * must have a url property, and buttons with action='automation' must have an
 * automation property.
 *
 * @param field - Object containing action and optional url/automation properties
 * @returns Error message if validation fails, true if validation passes
 *
 * @example
 * ```typescript
 * validateButtonAction({ action: 'url', url: 'https://example.com' })  // true (valid)
 * validateButtonAction({ action: 'url' })                              // 'url is required when action is url'
 * validateButtonAction({ action: 'automation', automation: 'approve' }) // true (valid)
 * validateButtonAction({ action: 'automation' })                       // 'automation is required when action is automation'
 * validateButtonAction({ action: 'custom' })                           // true (no requirements)
 * ```
 */
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
