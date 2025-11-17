/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { PageIdSchema } from './id'

describe('PageIdSchema', () => {
  describe('Valid page IDs', () => {
    test('should accept simple lowercase string', () => {
      // Given
      const pageId = 'homepage'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept kebab-case string', () => {
      // Given
      const pageId = 'about-us'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept string with numbers', () => {
      // Given
      const pageId = 'contact-form-123'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept UUID format', () => {
      // Given
      const pageId = '550e8400-e29b-41d4-a716-446655440000'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept numeric string', () => {
      // Given
      const pageId = '12345'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept single character', () => {
      // Given
      const pageId = 'a'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept uppercase string', () => {
      // Given
      const pageId = 'HOME'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept mixed case string', () => {
      // Given
      const pageId = 'HomePage'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept string with underscores', () => {
      // Given
      const pageId = 'home_page'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept string with dots', () => {
      // Given
      const pageId = 'v1.2.3'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept complex mixed format', () => {
      // Given
      const pageId = 'page_v1.2-beta_FINAL'

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })

    test('should accept very long string', () => {
      // Given
      const pageId = 'a'.repeat(100) // 100 characters

      // When
      const result = Schema.decodeUnknownSync(PageIdSchema)(pageId)

      // Then
      expect(result).toBe(pageId)
    })
  })

  describe('Invalid page IDs', () => {
    test('should reject empty string', () => {
      // Given
      const pageId = ''

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageIdSchema)(pageId)
      }).toThrow()
    })

    test('should reject null', () => {
      // Given
      const pageId = null

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageIdSchema)(pageId)
      }).toThrow()
    })

    test('should reject undefined', () => {
      // Given
      const pageId = undefined

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageIdSchema)(pageId)
      }).toThrow()
    })

    test('should reject number', () => {
      // Given
      const pageId = 123

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageIdSchema)(pageId)
      }).toThrow()
    })

    test('should reject boolean', () => {
      // Given
      const pageId = true

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageIdSchema)(pageId)
      }).toThrow()
    })

    test('should reject object', () => {
      // Given
      const pageId = { id: 'homepage' }

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageIdSchema)(pageId)
      }).toThrow()
    })

    test('should reject array', () => {
      // Given
      const pageId = ['homepage']

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageIdSchema)(pageId)
      }).toThrow()
    })
  })

  describe('Schema metadata', () => {
    test('should have correct annotations', () => {
      // When
      const ast = PageIdSchema.ast
      const annotations = ast.annotations

      // Then
      expect(annotations.identifier).toBe('PageId')
      expect(annotations.title).toBe('Page ID')
      expect(annotations.description).toBe('Unique identifier for the page')
      expect(annotations.examples).toEqual([
        'homepage',
        'about-us',
        'contact-form-123',
        '550e8400-e29b-41d4-a716-446655440000',
      ])
    })
  })
})