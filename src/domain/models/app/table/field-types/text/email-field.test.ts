/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { EmailFieldSchema } from './email-field'

describe('EmailFieldSchema', () => {
  test('should accept valid email field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'email',
      type: 'email' as const,
      required: true,
      unique: true,
      indexed: true,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(EmailFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept email field with default value', () => {
    // Given: A configuration with default value
    const field = {
      id: 2,
      name: 'contact_email',
      type: 'email' as const,
      required: false,
      default: 'contact@example.com',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(EmailFieldSchema)(field)
    expect(result.default).toBe('contact@example.com')
  })

  test('should accept minimal email field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'email',
      type: 'email' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(EmailFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'email',
      type: 'url' as const,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(EmailFieldSchema)(field)
    }).toThrow()
  })

  test('should accept email with unique constraint for authentication', () => {
    // Given: A valid configuration
    const field = {
      id: 1,
      name: 'user_email',
      type: 'email' as const,
      required: true,
      unique: true,
      indexed: true,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(EmailFieldSchema)(field)
    expect(result.unique).toBe(true)
    expect(result.indexed).toBe(true)
  })
})
