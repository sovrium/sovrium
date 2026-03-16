/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { UrlFieldSchema } from './url-field'

describe('UrlFieldSchema', () => {
  test('should accept valid URL field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'website',
      type: 'url' as const,
      required: true,
      unique: false,
      indexed: true,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(UrlFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept URL field with default value', () => {
    // Given: A configuration with default value
    const field = {
      id: 2,
      name: 'profile_url',
      type: 'url' as const,
      required: false,
      default: 'https://example.com/profile',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(UrlFieldSchema)(field)
    expect(result.default).toBe('https://example.com/profile')
  })

  test('should accept minimal URL field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'website',
      type: 'url' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(UrlFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'website',
      type: 'email' as const,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(UrlFieldSchema)(field)
    }).toThrow()
  })

  test('should accept https URL as default', () => {
    // Given: A configuration with default value
    const field = {
      id: 1,
      name: 'api_endpoint',
      type: 'url' as const,
      default: 'https://api.example.com/v1',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(UrlFieldSchema)(field)
    expect(result.default).toBe('https://api.example.com/v1')
  })
})
