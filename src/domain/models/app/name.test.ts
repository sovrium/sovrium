/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Schema, ParseResult } from 'effect'
import { NameSchema } from './name'

describe('NameSchema', () => {
  describe('Valid names - npm package naming rules', () => {
    test('should accept lowercase package names', () => {
      // GIVEN: A valid lowercase package name
      const packageName = 'todo-app'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted without modification
      expect(result).toBe('todo-app')
    })

    test('should accept single character lowercase names', () => {
      // GIVEN: A single lowercase character name
      const packageName = 'x'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('x')
    })

    test('should accept names with hyphens', () => {
      // GIVEN: A package name containing hyphens
      const packageName = 'my-awesome-app'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('my-awesome-app')
    })

    test('should accept names with underscores (not at start)', () => {
      // GIVEN: A package name with underscores in the middle
      const packageName = 'my_app'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('my_app')
    })

    test('should accept names with dots (not at start)', () => {
      // GIVEN: A package name with dots in the middle
      const packageName = 'my.app'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('my.app')
    })

    test('should accept names with numbers', () => {
      // GIVEN: A package name containing numbers
      const packageName = 'app123'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('app123')
    })

    test('should accept scoped package names', () => {
      // GIVEN: A scoped package name with organization prefix
      const packageName = '@myorg/my-app'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('@myorg/my-app')
    })

    test('should accept scoped packages with complex names', () => {
      // GIVEN: A scoped package with complex multi-word name
      const packageName = '@company/project-name'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('@company/project-name')
    })

    test('should accept URL-safe characters', () => {
      // GIVEN: A package name with URL-safe characters (hyphens, underscores, dots)
      const packageName = 'my-app_v2.0'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(packageName)

      // THEN: The name should be accepted
      expect(result).toBe('my-app_v2.0')
    })

    test('should accept long names up to 214 characters', () => {
      // GIVEN: A package name at the maximum allowed length of 214 characters
      const longName = 'a'.repeat(214)

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(longName)

      // THEN: The name should be accepted
      expect(result).toBe(longName)
    })
  })

  describe('Invalid names - uppercase', () => {
    test('should reject names with uppercase letters', () => {
      // GIVEN: A package name containing uppercase letters
      const invalidName = 'MyApp'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names with mixed case', () => {
      // GIVEN: A package name with mixed uppercase and lowercase letters
      const invalidName = 'Todo-App'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject all uppercase names', () => {
      // GIVEN: A package name in all uppercase
      const invalidName = 'MYAPP'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })
  })

  describe('Invalid names - leading characters', () => {
    test('should reject names starting with dot', () => {
      // GIVEN: A package name starting with a dot
      const invalidName = '.myapp'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names starting with underscore', () => {
      // GIVEN: A package name starting with an underscore
      const invalidName = '_private'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject scoped packages with underscore in scope', () => {
      // GIVEN: A scoped package with underscore in the organization name
      const invalidName = '@_org/package'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })
  })

  describe('Invalid names - spaces', () => {
    test('should reject names with spaces', () => {
      // GIVEN: A package name containing spaces
      const invalidName = 'my app'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names with leading spaces', () => {
      // GIVEN: A package name with a leading space
      const invalidName = ' myapp'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names with trailing spaces', () => {
      // GIVEN: A package name with a trailing space
      const invalidName = 'myapp '

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })
  })

  describe('Invalid names - non-URL-safe characters', () => {
    test('should reject names with parentheses', () => {
      // GIVEN: A package name containing parentheses
      const invalidName = 'my-app(beta)'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names with special characters', () => {
      // GIVEN: A package name containing special characters
      const invalidName = 'my-app!'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names with ampersands', () => {
      // GIVEN: A package name containing an ampersand
      const invalidName = 'my&app'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names with slashes (non-scoped)', () => {
      // GIVEN: A non-scoped package name containing a slash
      const invalidName = 'my/app'

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })
  })

  describe('Invalid names - length constraints', () => {
    test('should reject empty names', () => {
      // GIVEN: An empty string as package name
      const invalidName = ''

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidName)
      }).toThrow()
    })

    test('should reject names exceeding 214 characters', () => {
      // GIVEN: A package name exceeding the 214 character limit
      const tooLongName = 'a'.repeat(215)

      // WHEN: The name is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(tooLongName)
      }).toThrow()
    })

    test('should provide helpful error message for too long names', () => {
      // GIVEN: A package name exceeding the 214 character limit
      const tooLongName = 'a'.repeat(215)

      // WHEN: The name is validated against the schema
      try {
        Schema.decodeUnknownSync(NameSchema)(tooLongName)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // THEN: Error should be ParseError and mention the 214 character limit
        expect(error).toBeInstanceOf(ParseResult.ParseError)
        const message = String(error)
        expect(message).toContain('214 characters')
      }
    })
  })

  describe('Invalid data - wrong types', () => {
    test('should reject non-string name', () => {
      // GIVEN: A number instead of a string
      const invalidInput = 123

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject null values', () => {
      // GIVEN: A null value
      const invalidInput = null

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject undefined values', () => {
      // GIVEN: An undefined value
      const invalidInput = undefined

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject array value', () => {
      // GIVEN: An array instead of a string
      const invalidInput = ['test-app']

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject object value', () => {
      // GIVEN: An object instead of a string
      const invalidInput = { value: 'test-app' }

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(NameSchema)(invalidInput as any)
      }).toThrow()
    })
  })

  describe('Type inference', () => {
    test('should have correct TypeScript type', () => {
      // GIVEN: A valid package name
      const name = 'type-test'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(name)

      // THEN: TypeScript should infer the result as string type
      const typedName: string = result
      expect(typedName).toBe('type-test')
    })
  })

  describe('Encoding', () => {
    test('should encode valid name', () => {
      // GIVEN: A valid package name
      const name = 'encode-test'

      // WHEN: The name is encoded using the schema
      const encoded = Schema.encodeSync(NameSchema)(name)

      // THEN: The encoded value should match the original name
      expect(encoded).toBe('encode-test')
    })
  })

  describe('Real-world examples', () => {
    test('should validate todo application name', () => {
      // GIVEN: A real-world todo application name
      const appName = 'todo-master'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(appName)

      // THEN: The name should be accepted
      expect(result).toBe('todo-master')
    })

    test('should validate e-commerce application name', () => {
      // GIVEN: A real-world e-commerce application name
      const appName = 'shoppro'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(appName)

      // THEN: The name should be accepted
      expect(result).toBe('shoppro')
    })

    test('should validate blog application name', () => {
      // GIVEN: A real-world blog application name
      const appName = 'blogcraft'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(appName)

      // THEN: The name should be accepted
      expect(result).toBe('blogcraft')
    })

    test('should validate dashboard application name', () => {
      // GIVEN: A real-world dashboard application name
      const appName = 'dashboard-admin'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(appName)

      // THEN: The name should be accepted
      expect(result).toBe('dashboard-admin')
    })

    test('should validate scoped organization package', () => {
      // GIVEN: A real-world scoped organization package name
      const appName = '@acme/product'

      // WHEN: The name is validated against the schema
      const result = Schema.decodeUnknownSync(NameSchema)(appName)

      // THEN: The name should be accepted
      expect(result).toBe('@acme/product')
    })
  })
})
