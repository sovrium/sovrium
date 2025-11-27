/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Schema, ParseResult } from 'effect'
import { DescriptionSchema } from './description'

describe('DescriptionSchema', () => {
  describe('Valid descriptions - single line strings', () => {
    test('should accept simple single-line description', () => {
      // GIVEN: A simple single-line description
      const description = 'A simple application'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted without modification
      expect(result).toBe('A simple application')
    })

    test('should accept empty string', () => {
      // GIVEN: An empty string
      const description = ''

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The empty string should be accepted
      expect(result).toBe('')
    })

    test('should accept description with special characters', () => {
      // GIVEN: A description with special characters
      const description = 'My app - with special characters!@#$%^&*()_+{}[]|:;<>,.?/~`'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('My app - with special characters!@#$%^&*()_+{}[]|:;<>,.?/~`')
    })

    test('should accept description with unicode characters', () => {
      // GIVEN: A description with unicode characters
      const description = 'Très bien! 你好世界 مرحبا'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('Très bien! 你好世界 مرحبا')
    })

    test('should accept description with emojis', () => {
      // GIVEN: A description with emojis
      const description = 'A cool app 🎉 with emojis 🚀 and fun 💯'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('A cool app 🎉 with emojis 🚀 and fun 💯')
    })

    test('should accept very long description', () => {
      // GIVEN: A very long description (500 characters)
      const description = 'a'.repeat(500)

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe(description)
    })

    test('should reject description exceeding max length', () => {
      // GIVEN: A description exceeding 500 characters
      const description = 'a'.repeat(501)

      // WHEN: The description is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
      }).toThrow()
    })

    test('should provide helpful error message for max length', () => {
      // GIVEN: A description exceeding 500 characters
      const description = 'a'.repeat(501)

      // WHEN: The description is validated against the schema
      try {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // THEN: Error should be ParseError and mention max length
        expect(error).toBeInstanceOf(ParseResult.ParseError)
        const message = String(error)
        expect(message).toContain('500')
      }
    })

    test('should accept description with multiple spaces', () => {
      // GIVEN: A description with multiple consecutive spaces
      const description = 'This  has    multiple     spaces'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted as-is
      expect(result).toBe('This  has    multiple     spaces')
    })

    test('should accept description with leading spaces', () => {
      // GIVEN: A description with leading spaces
      const description = '   Leading spaces'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted as-is
      expect(result).toBe('   Leading spaces')
    })

    test('should accept description with trailing spaces', () => {
      // GIVEN: A description with trailing spaces
      const description = 'Trailing spaces   '

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted as-is
      expect(result).toBe('Trailing spaces   ')
    })

    test('should accept description with tabs', () => {
      // GIVEN: A description with tab characters
      const description = 'Description\twith\ttabs'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('Description\twith\ttabs')
    })
  })

  describe('Invalid descriptions - line breaks', () => {
    test('should reject description with unix line break (\\n)', () => {
      // GIVEN: A description with unix line break
      const description = 'First line\nSecond line'

      // WHEN: The description is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
      }).toThrow()
    })

    test('should reject description with windows line break (\\r\\n)', () => {
      // GIVEN: A description with windows line break
      const description = 'First line\r\nSecond line'

      // WHEN: The description is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
      }).toThrow()
    })

    test('should reject description with mac line break (\\r)', () => {
      // GIVEN: A description with classic mac line break
      const description = 'First line\rSecond line'

      // WHEN: The description is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
      }).toThrow()
    })

    test('should reject description with multiple line breaks', () => {
      // GIVEN: A description with multiple line breaks
      const description = 'Line 1\nLine 2\nLine 3\nLine 4'

      // WHEN: The description is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
      }).toThrow()
    })

    test('should reject description with line break at start', () => {
      // GIVEN: A description starting with a line break
      const description = '\nDescription'

      // WHEN: The description is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
      }).toThrow()
    })

    test('should reject description with line break at end', () => {
      // GIVEN: A description ending with a line break
      const description = 'Description\n'

      // WHEN: The description is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
      }).toThrow()
    })

    test('should provide helpful error message for line breaks', () => {
      // GIVEN: A description with line breaks
      const description = 'Multi\nline'

      // WHEN: The description is validated against the schema
      try {
        Schema.decodeUnknownSync(DescriptionSchema)(description)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // THEN: Error should be ParseError and mention line breaks
        expect(error).toBeInstanceOf(ParseResult.ParseError)
        const message = String(error)
        expect(message).toContain('single line')
        expect(message).toContain('line breaks')
      }
    })
  })

  describe('Invalid data - wrong types', () => {
    test('should reject non-string description (number)', () => {
      // GIVEN: A number instead of a string
      const invalidInput = 123

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject null values', () => {
      // GIVEN: A null value
      const invalidInput = null

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject undefined values', () => {
      // GIVEN: An undefined value
      const invalidInput = undefined

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject array value', () => {
      // GIVEN: An array instead of a string
      const invalidInput = ['test description']

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject object value', () => {
      // GIVEN: An object instead of a string
      const invalidInput = { value: 'test description' }

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject boolean value', () => {
      // GIVEN: A boolean instead of a string
      const invalidInput = true

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(DescriptionSchema)(invalidInput as any)
      }).toThrow()
    })
  })

  describe('Type inference', () => {
    test('should have correct TypeScript type', () => {
      // GIVEN: A valid description
      const description = 'Type test description'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: TypeScript should infer the result as string type
      const typedDescription: string = result
      expect(typedDescription).toBe('Type test description')
    })
  })

  describe('Encoding', () => {
    test('should encode valid description', () => {
      // GIVEN: A valid description
      const description = 'Encode test'

      // WHEN: The description is encoded using the schema
      const encoded = Schema.encodeSync(DescriptionSchema)(description)

      // THEN: The encoded value should match the original description
      expect(encoded).toBe('Encode test')
    })

    test('should encode empty string', () => {
      // GIVEN: An empty string
      const description = ''

      // WHEN: The description is encoded using the schema
      const encoded = Schema.encodeSync(DescriptionSchema)(description)

      // THEN: The encoded value should be empty string
      expect(encoded).toBe('')
    })
  })

  describe('Real-world examples', () => {
    test('should validate todo application description', () => {
      // GIVEN: A real-world todo application description
      const description = 'A simple and efficient todo list application for managing daily tasks'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('A simple and efficient todo list application for managing daily tasks')
    })

    test('should validate e-commerce application description', () => {
      // GIVEN: A real-world e-commerce application description
      const description =
        'Full-featured e-commerce platform with cart, checkout & payment processing'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe(
        'Full-featured e-commerce platform with cart, checkout & payment processing'
      )
    })

    test('should validate blog application description', () => {
      // GIVEN: A real-world blog application description
      const description = 'Modern blogging platform with markdown support and SEO optimization'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('Modern blogging platform with markdown support and SEO optimization')
    })

    test('should validate dashboard description', () => {
      // GIVEN: A real-world dashboard description
      const description = 'Admin dashboard for analytics, user management & reporting'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('Admin dashboard for analytics, user management & reporting')
    })

    test('should validate multilingual description', () => {
      // GIVEN: A description with multiple languages
      const description = 'Application multilingue - 多言語アプリ - تطبيق متعدد اللغات'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('Application multilingue - 多言語アプリ - تطبيق متعدد اللغات')
    })
  })

  describe('Edge cases', () => {
    test('should accept description with only spaces', () => {
      // GIVEN: A description containing only spaces
      const description = '     '

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('     ')
    })

    test('should accept description with quotes', () => {
      // GIVEN: A description with various quote types
      const description = 'App with "double quotes" and \'single quotes\' and `backticks`'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('App with "double quotes" and \'single quotes\' and `backticks`')
    })

    test('should accept description with brackets and parentheses', () => {
      // GIVEN: A description with various brackets
      const description = 'App with [brackets], {braces}, and (parentheses)'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('App with [brackets], {braces}, and (parentheses)')
    })

    test('should accept description with URL', () => {
      // GIVEN: A description containing a URL
      const description = 'Check out https://example.com for more info'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('Check out https://example.com for more info')
    })

    test('should accept description with HTML-like characters', () => {
      // GIVEN: A description with HTML-like characters
      const description = 'App for <markup> & HTML entities like &amp; and &lt;'

      // WHEN: The description is validated against the schema
      const result = Schema.decodeUnknownSync(DescriptionSchema)(description)

      // THEN: The description should be accepted
      expect(result).toBe('App for <markup> & HTML entities like &amp; and &lt;')
    })
  })
})
