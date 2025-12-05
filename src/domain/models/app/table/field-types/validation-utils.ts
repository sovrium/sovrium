/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
