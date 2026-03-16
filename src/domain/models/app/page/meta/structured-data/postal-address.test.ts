/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PostalAddressSchema } from './postal-address'

describe('PostalAddressSchema', () => {
  test('should accept minimal postal address with only @type', () => {
    // GIVEN: Minimal postal address
    const postalAddress = {
      '@type': 'PostalAddress' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PostalAddressSchema)(postalAddress)

    // THEN: Minimal postal address should be accepted
    expect(result['@type']).toBe('PostalAddress')
  })

  test('should accept complete US address', () => {
    // GIVEN: Complete US address
    const postalAddress = {
      '@type': 'PostalAddress' as const,
      streetAddress: '123 Main St',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      postalCode: '94105',
      addressCountry: 'US',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PostalAddressSchema)(postalAddress)

    // THEN: Complete US address should be accepted
    expect(result.streetAddress).toBe('123 Main St')
    expect(result.addressLocality).toBe('San Francisco')
    expect(result.addressRegion).toBe('CA')
    expect(result.postalCode).toBe('94105')
    expect(result.addressCountry).toBe('US')
  })

  test('should accept complete French address', () => {
    // GIVEN: Complete French address
    const postalAddress = {
      '@type': 'PostalAddress' as const,
      streetAddress: '45 Rue de la Paix',
      addressLocality: 'Strasbourg',
      addressRegion: 'Grand Est',
      postalCode: '67000',
      addressCountry: 'FR',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PostalAddressSchema)(postalAddress)

    // THEN: Complete French address should be accepted
    expect(result.addressCountry).toBe('FR')
    expect(result.addressLocality).toBe('Strasbourg')
  })

  test('should accept valid ISO 3166-1 alpha-2 country codes', () => {
    // GIVEN: Various valid country codes
    const countryCodes = ['US', 'FR', 'GB', 'DE', 'JP', 'CA', 'AU', 'IT']

    countryCodes.forEach((country) => {
      const postalAddress = {
        '@type': 'PostalAddress' as const,
        addressCountry: country,
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(PostalAddressSchema)(postalAddress)

      // THEN: Country code should be accepted
      expect(result.addressCountry).toBe(country)
    })
  })

  test('should reject invalid country code with lowercase letters', () => {
    // GIVEN: Country code with lowercase letters
    const postalAddress = {
      '@type': 'PostalAddress' as const,
      addressCountry: 'us',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be uppercase)
    expect(() => Schema.decodeUnknownSync(PostalAddressSchema)(postalAddress)).toThrow()
  })

  test('should reject invalid country code with 3 letters', () => {
    // GIVEN: Country code with 3 letters (ISO 3166-1 alpha-3)
    const postalAddress = {
      '@type': 'PostalAddress' as const,
      addressCountry: 'USA',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be exactly 2 letters)
    expect(() => Schema.decodeUnknownSync(PostalAddressSchema)(postalAddress)).toThrow()
  })

  test('should reject invalid country code with 1 letter', () => {
    // GIVEN: Country code with 1 letter
    const postalAddress = {
      '@type': 'PostalAddress' as const,
      addressCountry: 'U',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be exactly 2 letters)
    expect(() => Schema.decodeUnknownSync(PostalAddressSchema)(postalAddress)).toThrow()
  })
})
