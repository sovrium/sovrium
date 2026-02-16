/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { CurrencyFieldSchema } from './currency-field'

describe('CurrencyFieldSchema', () => {
  test('should accept valid currency field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'price',
      type: 'currency' as const,
      required: true,
      currency: 'USD',
      precision: 2,
      min: 0,
      default: 0.0,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(CurrencyFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept currency field without precision (optional)', () => {
    // Given: A valid configuration
    const field = {
      id: 1,
      name: 'price',
      type: 'currency' as const,
      currency: 'USD',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(CurrencyFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept EUR currency', () => {
    // Given: A valid configuration
    const field = {
      id: 2,
      name: 'total_cost',
      type: 'currency' as const,
      required: true,
      currency: 'EUR',
      precision: 2,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(CurrencyFieldSchema)(field)
    expect(result.currency).toBe('EUR')
  })

  test('should accept minimal currency field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'amount',
      type: 'currency' as const,
      currency: 'GBP',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(CurrencyFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject missing currency code', () => {
    // Given: A configuration missing a required property
    const field = {
      id: 1,
      name: 'price',
      type: 'currency' as const,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing missing required property: currency
      Schema.decodeSync(CurrencyFieldSchema)(field)
    }).toThrow()
  })

  test('should reject invalid currency code (not 3 letters)', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'price',
      type: 'currency' as const,
      currency: 'US',

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(CurrencyFieldSchema)(field)
    }).toThrow()
  })

  test('should reject lowercase currency code', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'price',
      type: 'currency' as const,
      currency: 'usd',

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(CurrencyFieldSchema)(field)
    }).toThrow()
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'price',
      type: 'decimal' as const,
      currency: 'USD',

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(CurrencyFieldSchema)(field)
    }).toThrow()
  })

  test('should accept various ISO 4217 currency codes', () => {
    // Given: A valid configuration
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']

    currencies.forEach((currency) => {
      const field = {
        id: 1,
        name: 'price',
        type: 'currency' as const,
        currency,

        // When: The value is validated against the schema
        // Then: Validation succeeds and the value is accepted
      }

      const result = Schema.decodeSync(CurrencyFieldSchema)(field)
      expect(result.currency).toBe(currency)
    })
  })

  test('should reject precision greater than 10', () => {
    // Given: An invalid input
    const field = {
      id: 1,
      name: 'price',
      type: 'currency' as const,
      currency: 'USD',
      precision: 11,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      Schema.decodeSync(CurrencyFieldSchema)(field)
    }).toThrow()
  })
})
