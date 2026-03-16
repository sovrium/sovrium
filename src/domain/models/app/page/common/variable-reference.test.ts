/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { VariableReferenceSchema } from './variable-reference'

describe('VariableReferenceSchema', () => {
  test('should accept simple variable reference', () => {
    // GIVEN: Simple variable reference
    const value = '$color'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariableReferenceSchema)(value)

    // THEN: Variable reference should be accepted
    expect(result).toBe('$color')
  })

  test('should accept variable reference with camelCase name', () => {
    // GIVEN: Variable with camelCase naming
    const value = '$primaryText'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariableReferenceSchema)(value)

    // THEN: CamelCase variable should be accepted
    expect(result).toBe('$primaryText')
  })

  test('should accept string with variable at the start', () => {
    // GIVEN: String with variable at start
    const value = '$siteName is the best'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariableReferenceSchema)(value)

    // THEN: Variable at start should be accepted
    expect(result).toBe('$siteName is the best')
  })

  test('should accept string with variable in the middle', () => {
    // GIVEN: String with variable in middle
    const value = 'Welcome to $siteName today'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariableReferenceSchema)(value)

    // THEN: Variable in middle should be accepted
    expect(result).toBe('Welcome to $siteName today')
  })

  test('should accept string with variable at the end', () => {
    // GIVEN: String with variable at end
    const value = 'The color is $primaryColor'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariableReferenceSchema)(value)

    // THEN: Variable at end should be accepted
    expect(result).toBe('The color is $primaryColor')
  })

  test('should accept string with multiple variables', () => {
    // GIVEN: String with multiple variable references
    const value = 'The $productName costs $price'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariableReferenceSchema)(value)

    // THEN: Multiple variables should be accepted
    expect(result).toBe('The $productName costs $price')
  })

  test('should accept variable reference with numbers in name', () => {
    // GIVEN: Variables with numbers
    const values = ['$color1', '$size2x']

    // WHEN: Schema validation is performed on each
    const results = values.map((v) => Schema.decodeUnknownSync(VariableReferenceSchema)(v))

    // THEN: All should be accepted
    expect(results).toEqual(values)
  })

  test('should accept complex variable combination', () => {
    // GIVEN: Complex variable composition
    const value = '$icon-$size'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(VariableReferenceSchema)(value)

    // THEN: Variable composition should be accepted
    expect(result).toBe('$icon-$size')
  })

  test('should reject string without variable reference', () => {
    // GIVEN: String without any variable
    const value = 'Just plain text'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(VariableReferenceSchema)(value)).toThrow()
  })

  test('should reject variable starting with number', () => {
    // GIVEN: Invalid variable starting with number
    const value = '$1color'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(VariableReferenceSchema)(value)).toThrow()
  })

  test('should reject dollar sign alone', () => {
    // GIVEN: Dollar sign without variable name
    const value = 'Price is $'

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(VariableReferenceSchema)(value)).toThrow()
  })
})
