/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { LongTextFieldSchema } from './long-text-field'

describe('LongTextFieldSchema', () => {
  test('should accept valid long-text field configuration', () => {
    // Given: A valid input
    const field = {
      id: 1,
      name: 'description',
      type: 'long-text' as const,
      required: true,
      indexed: false,
      default: 'Enter description here...',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(LongTextFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should accept minimal long-text field configuration', () => {
    // Given: A minimal valid configuration
    const field = {
      id: 1,
      name: 'notes',
      type: 'long-text' as const,

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(LongTextFieldSchema)(field)
    expect(result).toEqual(field)
  })

  test('should reject missing required property: type', () => {
    // Given: A configuration missing a required property
    const field = {
      id: 1,
      name: 'description',

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing missing required property: type
      Schema.decodeSync(LongTextFieldSchema)(field)
    }).toThrow()
  })

  test('should reject wrong type value', () => {
    // Given: A configuration with wrong type
    const field = {
      id: 1,
      name: 'description',
      type: 'single-line-text' as const,

      // When: The value is validated against the schema
      // Then: Validation should throw an error
    }

    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(LongTextFieldSchema)(field)
    }).toThrow()
  })

  test('should accept multi-line default value', () => {
    // Given: A configuration with default value
    const field = {
      id: 1,
      name: 'description',
      type: 'long-text' as const,
      default: 'Line 1\nLine 2\nLine 3',

      // When: The value is validated against the schema
      // Then: Validation succeeds and the value is accepted
    }

    const result = Schema.decodeSync(LongTextFieldSchema)(field)
    expect(result.default).toBe('Line 1\nLine 2\nLine 3')
  })
})
