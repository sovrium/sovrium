/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PhoneNumberFieldSchema } from './phone-number-field'

describe('PhoneNumberFieldSchema', () => {
  test('should accept valid phone number field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'mobile_phone',
      type: 'phone-number' as const,
      required: true,
      unique: true,
      indexed: true,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PhoneNumberFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept phone number field with default value', () => {
    // Given: A configuration with default value
    const field = {
      id: 2,
      name: 'office_phone',
      type: 'phone-number' as const,
      required: false,
      default: '+1 (555) 000-0000',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PhoneNumberFieldSchema)(field)
    expect(result.default).toBe('+1 (555) 000-0000')
  })

  test('should accept minimal phone number field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'phone',
      type: 'phone-number' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PhoneNumberFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'mobile_phone',
      type: 'email' as const,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(PhoneNumberFieldSchema)(field)
    }).toThrow()
  })

  test('should accept international phone number format as default', () => {
    // Given: A configuration with default value
    const field = {
      id: 1,
      name: 'phone',
      type: 'phone-number' as const,
      default: '+44 20 7123 4567',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(PhoneNumberFieldSchema)(field)
    expect(result.default).toBe('+44 20 7123 4567')
  })
})
