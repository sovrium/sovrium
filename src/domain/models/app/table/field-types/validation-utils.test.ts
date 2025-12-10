/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { validateMinMaxRange, createOptionsSchema, validateButtonAction } from './validation-utils'

describe('validateMinMaxRange', () => {
  test('returns undefined when both min and max are valid (min < max)', () => {
    expect(validateMinMaxRange({ min: 0, max: 100 })).toBeUndefined()
  })

  test('returns undefined when min equals max', () => {
    expect(validateMinMaxRange({ min: 50, max: 50 })).toBeUndefined()
  })

  test('returns error when min is greater than max', () => {
    expect(validateMinMaxRange({ min: 100, max: 10 })).toBe('min cannot be greater than max')
  })

  test('returns undefined when only min is specified', () => {
    expect(validateMinMaxRange({ min: 0 })).toBeUndefined()
  })

  test('returns undefined when only max is specified', () => {
    expect(validateMinMaxRange({ max: 100 })).toBeUndefined()
  })

  test('returns undefined when neither min nor max is specified', () => {
    expect(validateMinMaxRange({})).toBeUndefined()
  })

  test('handles negative numbers correctly', () => {
    expect(validateMinMaxRange({ min: -100, max: -10 })).toBeUndefined()
    expect(validateMinMaxRange({ min: -10, max: -100 })).toBe('min cannot be greater than max')
  })

  test('handles decimal numbers correctly', () => {
    expect(validateMinMaxRange({ min: 0.1, max: 0.9 })).toBeUndefined()
    expect(validateMinMaxRange({ min: 0.9, max: 0.1 })).toBe('min cannot be greater than max')
  })
})

describe('createOptionsSchema', () => {
  test('accepts valid options array with single item', () => {
    const schema = createOptionsSchema('single-select')
    const result = Schema.decodeSync(schema)(['Option1'])
    expect(result).toEqual(['Option1'])
  })

  test('accepts valid options array with multiple items', () => {
    const schema = createOptionsSchema('multi-select')
    const result = Schema.decodeSync(schema)(['Option1', 'Option2', 'Option3'])
    expect(result).toEqual(['Option1', 'Option2', 'Option3'])
  })

  test('rejects empty options array for single-select', () => {
    const schema = createOptionsSchema('single-select')
    expect(() => {
      Schema.decodeSync(schema)([])
    }).toThrow(/at least one option is required for single-select field/i)
  })

  test('rejects empty options array for multi-select', () => {
    const schema = createOptionsSchema('multi-select')
    expect(() => {
      Schema.decodeSync(schema)([])
    }).toThrow(/at least one option is required for multi-select field/i)
  })

  test('error message includes correct field type', () => {
    const singleSelectSchema = createOptionsSchema('single-select')
    const multiSelectSchema = createOptionsSchema('multi-select')

    expect(() => Schema.decodeSync(singleSelectSchema)([])).toThrow(/single-select/)
    expect(() => Schema.decodeSync(multiSelectSchema)([])).toThrow(/multi-select/)
  })

  test('rejects options array with duplicate values', () => {
    const schema = createOptionsSchema('multi-select')
    expect(() => {
      Schema.decodeSync(schema)(['tech', 'health', 'tech'])
    }).toThrow(/duplicate.*option|options.*unique/i)
  })

  test('accepts options array with unique values', () => {
    const schema = createOptionsSchema('multi-select')
    const result = Schema.decodeSync(schema)(['tech', 'health', 'finance'])
    expect(result).toEqual(['tech', 'health', 'finance'])
  })

  test('rejects single-select with duplicate values', () => {
    const schema = createOptionsSchema('single-select')
    expect(() => {
      Schema.decodeSync(schema)(['red', 'blue', 'red'])
    }).toThrow(/duplicate.*option|options.*unique/i)
  })
})

describe('validateButtonAction', () => {
  test('returns true when action=url and url is provided', () => {
    expect(validateButtonAction({ action: 'url', url: 'https://example.com' })).toBe(true)
  })

  test('returns error when action=url and url is missing', () => {
    expect(validateButtonAction({ action: 'url' })).toBe('url is required when action is url')
  })

  test('returns error when action=url and url is empty string', () => {
    expect(validateButtonAction({ action: 'url', url: '' })).toBe(
      'url is required when action is url'
    )
  })

  test('returns true when action=automation and automation is provided', () => {
    expect(validateButtonAction({ action: 'automation', automation: 'approve_request' })).toBe(true)
  })

  test('returns error when action=automation and automation is missing', () => {
    expect(validateButtonAction({ action: 'automation' })).toBe(
      'automation is required when action is automation'
    )
  })

  test('returns error when action=automation and automation is empty string', () => {
    expect(validateButtonAction({ action: 'automation', automation: '' })).toBe(
      'automation is required when action is automation'
    )
  })

  test('returns true when action is not url or automation', () => {
    expect(validateButtonAction({ action: 'custom' })).toBe(true)
    expect(validateButtonAction({ action: 'save' })).toBe(true)
    expect(validateButtonAction({ action: 'submit' })).toBe(true)
  })

  test('returns true when action=url has url and extra properties', () => {
    expect(
      validateButtonAction({ action: 'url', url: 'https://example.com', automation: 'ignored' })
    ).toBe(true)
  })

  test('returns true when action=automation has automation and extra properties', () => {
    expect(
      validateButtonAction({ action: 'automation', automation: 'approve', url: 'ignored' })
    ).toBe(true)
  })
})
