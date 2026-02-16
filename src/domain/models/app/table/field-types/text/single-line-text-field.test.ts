/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { SingleLineTextFieldSchema } from './single-line-text-field'

describe('SingleLineTextFieldSchema', () => {
  test('should accept valid single-line text field configuration', () => {
    // Given: A valid single-line text field configuration with all properties
    const field = {
      id: 1,
      name: 'title',
      type: 'single-line-text' as const,
      required: true,
      unique: false,
      indexed: true,
      default: 'Untitled',
    }

    // When: The field is validated against the schema
    const result = Schema.decodeSync(SingleLineTextFieldSchema)(field)

    // Then: Validation succeeds and returns the field unchanged
    expect(result).toEqual(field)
  })

  test('should accept minimal single-line text field configuration', () => {
    // Given: A minimal single-line text field configuration (required properties only)
    const field = {
      id: 1,
      name: 'first_name',
      type: 'single-line-text' as const,
    }

    // When: The field is validated against the schema
    const result = Schema.decodeSync(SingleLineTextFieldSchema)(field)

    // Then: Validation succeeds and returns the field unchanged
    expect(result).toEqual(field)
  })

  test('should reject missing required property: id', () => {
    // Given: A field configuration missing the id property
    const field = {
      name: 'title',
      type: 'single-line-text' as const,
    }

    // When: The field is validated against the schema
    // Then: Validation should throw an error
    expect(() => {
      // @ts-expect-error - Testing missing required property: id
      Schema.decodeSync(SingleLineTextFieldSchema)(field)
    }).toThrow()
  })

  test('should reject missing required property: name', () => {
    // Given: A field configuration missing the name property
    const field = {
      id: 1,
      type: 'single-line-text' as const,
    }

    // When: The field is validated against the schema
    // Then: Validation should throw an error
    expect(() => {
      // @ts-expect-error - Testing missing required property: name
      Schema.decodeSync(SingleLineTextFieldSchema)(field)
    }).toThrow()
  })

  test('should reject missing required property: type', () => {
    // Given: A field configuration missing the type property
    const field = {
      id: 1,
      name: 'title',
    }

    // When: The field is validated against the schema
    // Then: Validation should throw an error
    expect(() => {
      // @ts-expect-error - Testing missing required property: type
      Schema.decodeSync(SingleLineTextFieldSchema)(field)
    }).toThrow()
  })

  test('should reject wrong type value', () => {
    // Given: A field configuration with incorrect type value
    const field = {
      id: 1,
      name: 'title',
      type: 'long-text' as const,
    }

    // When: The field is validated against the schema
    // Then: Validation should throw an error
    expect(() => {
      // @ts-expect-error - Testing wrong type value
      Schema.decodeSync(SingleLineTextFieldSchema)(field)
    }).toThrow()
  })

  test('should reject invalid id (not a positive integer)', () => {
    // Given: A field configuration with negative id
    const field = {
      id: -1,
      name: 'title',
      type: 'single-line-text' as const,
    }

    // When: The field is validated against the schema
    // Then: Validation should throw an error
    expect(() => {
      Schema.decodeSync(SingleLineTextFieldSchema)(field)
    }).toThrow()
  })

  test('should reject invalid name (uppercase letters)', () => {
    // Given: A field configuration with uppercase letters in name
    const field = {
      id: 1,
      name: 'Title',
      type: 'single-line-text' as const,
    }

    // When: The field is validated against the schema
    // Then: Validation should throw an error
    expect(() => {
      Schema.decodeSync(SingleLineTextFieldSchema)(field)
    }).toThrow()
  })

  test('should accept default value as empty string', () => {
    // Given: A field configuration with empty string as default
    const field = {
      id: 1,
      name: 'title',
      type: 'single-line-text' as const,
      default: '',
    }

    // When: The field is validated against the schema
    const result = Schema.decodeSync(SingleLineTextFieldSchema)(field)

    // Then: The default value should be accepted as empty string
    expect(result.default).toBe('')
  })

  test('should accept default value as string with content', () => {
    // Given: A field configuration with non-empty default value
    const field = {
      id: 1,
      name: 'title',
      type: 'single-line-text' as const,
      default: 'Default Title',
    }

    // When: The field is validated against the schema
    const result = Schema.decodeSync(SingleLineTextFieldSchema)(field)

    // Then: The default value should be accepted
    expect(result.default).toBe('Default Title')
  })
})
