/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema, Option } from 'effect'
import * as AST from 'effect/SchemaAST'
import { PageNameSchema } from './name'

describe('PageNameSchema', () => {
  describe('Valid page names', () => {
    test('should accept single word', () => {
      // Given
      const name = 'Home'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept name with space', () => {
      // Given
      const name = 'About Us'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept multiple words', () => {
      // Given
      const name = 'Home Page'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept name with capital letters', () => {
      // Given
      const name = 'Pricing Plans'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept all lowercase', () => {
      // Given
      const name = 'contact'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept all uppercase', () => {
      // Given
      const name = 'FAQ'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept name with numbers', () => {
      // Given
      const name = 'Page 404'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept name with punctuation', () => {
      // Given
      const name = "What's New?"

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept name with special characters', () => {
      // Given
      const name = 'Terms & Conditions'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept name with hyphens', () => {
      // Given
      const name = 'Sign-Up Page'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept single character', () => {
      // Given
      const name = 'A'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept maximum length (63 characters)', () => {
      // Given
      const name = 'A'.repeat(63)

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
      expect(result.length).toBe(63)
    })

    test('should accept name with parentheses', () => {
      // Given
      const name = 'Home (Beta)'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept name with slashes', () => {
      // Given
      const name = 'Blog / News'

      // When
      const result = Schema.decodeUnknownSync(PageNameSchema)(name)

      // Then
      expect(result).toBe(name)
    })

    test('should accept international characters', () => {
      // Given
      const names = ['Café', 'Résumé', 'Über uns', 'こんにちは', 'Главная', '主页']

      // When/Then
      names.forEach((name) => {
        const result = Schema.decodeUnknownSync(PageNameSchema)(name)
        expect(result).toBe(name)
      })
    })
  })

  describe('Invalid page names', () => {
    test('should reject empty string', () => {
      // Given
      const name = ''

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject string longer than 63 characters', () => {
      // Given
      const name = 'A'.repeat(64)

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject very long string', () => {
      // Given
      const name =
        'This is a very long page name that exceeds the maximum allowed length of 63 characters'

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject null', () => {
      // Given
      const name = null

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject undefined', () => {
      // Given
      const name = undefined

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject number', () => {
      // Given
      const name = 123

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject boolean', () => {
      // Given
      const name = true

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject object', () => {
      // Given
      const name = { name: 'Home' }

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })

    test('should reject array', () => {
      // Given
      const name = ['Home']

      // When/Then
      expect(() => {
        Schema.decodeUnknownSync(PageNameSchema)(name)
      }).toThrow()
    })
  })

  describe('Schema metadata', () => {
    test('should have correct annotations', () => {
      // When
      const { ast } = PageNameSchema
      const title = Option.getOrUndefined(AST.getTitleAnnotation(ast))
      const description = Option.getOrUndefined(AST.getDescriptionAnnotation(ast))
      const examples = Option.getOrUndefined(AST.getExamplesAnnotation(ast))

      // Then
      expect(title).toBe('Page Name')
      expect(description).toBe('Human-readable name for the page')
      expect(examples).toEqual(['Home', 'About Us', 'Home Page', 'Pricing', 'Contact'])
    })
  })
})
