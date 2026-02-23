/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ComponentPropsSchema, ComponentPropValueSchema } from './component-props'

describe('ComponentPropValueSchema', () => {
  test('should accept string values', () => {
    // GIVEN: String property value
    const value = 'text-$color bg-$bgColor'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropValueSchema)(value)

    // THEN: String should be accepted
    expect(result).toBe('text-$color bg-$bgColor')
  })

  test('should accept number values', () => {
    // GIVEN: Number property value
    const value = 100

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropValueSchema)(value)

    // THEN: Number should be accepted
    expect(result).toBe(100)
  })

  test('should accept boolean values', () => {
    // GIVEN: Boolean property values
    const trueValue = true
    const falseValue = false

    // WHEN: Schema validation is performed
    const result1 = Schema.decodeUnknownSync(ComponentPropValueSchema)(trueValue)
    const result2 = Schema.decodeUnknownSync(ComponentPropValueSchema)(falseValue)

    // THEN: Booleans should be accepted
    expect(result1).toBe(true)
    expect(result2).toBe(false)
  })

  test('should accept object values', () => {
    // GIVEN: Object property value
    const value = { nested: 'value', count: 10 }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropValueSchema)(value)

    // THEN: Object should be accepted
    expect(result).toEqual({ nested: 'value', count: 10 })
  })

  test('should accept array values', () => {
    // GIVEN: Array property value
    const value = [1, 2, 3, 'four']

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropValueSchema)(value)

    // THEN: Array should be accepted
    expect(result).toEqual([1, 2, 3, 'four'])
  })
})

describe('ComponentPropsSchema', () => {
  test('should accept props with string values', () => {
    // GIVEN: Props with string property
    const props = {
      className: 'text-$color bg-$bgColor',
      size: '$size',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropsSchema)(props)

    // THEN: Props should be accepted
    expect(result.className).toBe('text-$color bg-$bgColor')
    expect(result.size).toBe('$size')
  })

  test('should accept props with mixed value types', () => {
    // GIVEN: Props with various value types
    const props = {
      className: 'text-$color',
      enabled: true,
      count: 10,
      maxWidth: 'max-w-$width',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropsSchema)(props)

    // THEN: All prop types should be accepted
    expect(result.className).toBe('text-$color')
    expect(result.enabled).toBe(true)
    expect(result.count).toBe(10)
    expect(result.maxWidth).toBe('max-w-$width')
  })

  test('should accept props with nested objects', () => {
    // GIVEN: Props with nested object value
    const props = {
      style: {
        color: 'red',
        fontSize: 16,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropsSchema)(props)

    // THEN: Nested object should be accepted
    expect(result.style).toEqual({ color: 'red', fontSize: 16 })
  })

  test('should accept props with array values', () => {
    // GIVEN: Props with array value
    const props = {
      items: ['one', 'two', 'three'],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropsSchema)(props)

    // THEN: Array should be accepted
    expect(result.items).toEqual(['one', 'two', 'three'])
  })

  test('should accept empty props object', () => {
    // GIVEN: Empty props
    const props = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropsSchema)(props)

    // THEN: Empty object should be accepted
    expect(result).toEqual({})
  })

  test('should accept alphanumeric keys', () => {
    // GIVEN: Props with camelCase keys
    const props = {
      className: 'text-blue',
      maxWidth: '100%',
      zIndex: 10,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropsSchema)(props)

    // THEN: All keys should be accepted
    expect(Object.keys(result)).toHaveLength(3)
  })

  test('should filter out keys starting with numbers', () => {
    // GIVEN: Props with invalid key (starts with number)
    const props = {
      '2xl': 'value',
      validKey: 'valid',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ComponentPropsSchema)(props)

    // THEN: Invalid key should be filtered out
    expect(result['2xl']).toBeUndefined()
    expect(result.validKey).toBe('valid')
  })
})
