/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Schema, ParseResult } from 'effect'
import { VersionSchema } from './version'

describe('VersionSchema', () => {
  describe('Valid versions - Basic SemVer format', () => {
    test('should accept basic version 1.0.0', () => {
      // GIVEN: A basic semantic version string
      const version = '1.0.0'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted without modification
      expect(result).toBe('1.0.0')
    })

    test('should accept version 0.0.0', () => {
      // GIVEN: The minimum semantic version (zero major, minor, patch)
      const version = '0.0.0'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('0.0.0')
    })

    test('should accept version 0.0.1', () => {
      // GIVEN: A version with patch number only
      const version = '0.0.1'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('0.0.1')
    })

    test('should accept version 1.2.3', () => {
      // GIVEN: A version with all three components non-zero
      const version = '1.2.3'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.2.3')
    })

    test('should accept version with large numbers', () => {
      // GIVEN: A version with large version numbers
      const version = '123.456.789'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('123.456.789')
    })

    test('should accept version 10.20.30', () => {
      // GIVEN: A version with multi-digit numbers
      const version = '10.20.30'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('10.20.30')
    })
  })

  describe('Valid versions - Pre-release identifiers', () => {
    test('should accept version with alpha pre-release', () => {
      // GIVEN: A version with alpha pre-release identifier
      const version = '1.0.0-alpha'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-alpha')
    })

    test('should accept version with beta pre-release', () => {
      // GIVEN: A version with beta pre-release identifier
      const version = '1.0.0-beta'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-beta')
    })

    test('should accept version with numbered pre-release', () => {
      // GIVEN: A version with numbered pre-release identifier
      const version = '1.0.0-beta.1'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-beta.1')
    })

    test('should accept version with rc pre-release', () => {
      // GIVEN: A version with release candidate pre-release identifier
      const version = '2.0.0-rc.1'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('2.0.0-rc.1')
    })

    test('should accept version with multiple pre-release identifiers', () => {
      // GIVEN: A version with multiple dot-separated pre-release identifiers
      const version = '1.0.0-alpha.beta.1'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-alpha.beta.1')
    })

    test('should accept version with hyphenated pre-release', () => {
      // GIVEN: A version with hyphen in pre-release identifier
      const version = '1.0.0-x-y-z'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-x-y-z')
    })

    test('should accept version with numeric pre-release', () => {
      // GIVEN: A version with purely numeric pre-release identifier
      const version = '1.0.0-0'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-0')
    })
  })

  describe('Valid versions - Build metadata', () => {
    test('should accept version with build metadata', () => {
      // GIVEN: A version with build metadata
      const version = '1.0.0+build.123'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0+build.123')
    })

    test('should accept version with numeric build metadata', () => {
      // GIVEN: A version with numeric build metadata
      const version = '1.0.0+20130313144700'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0+20130313144700')
    })

    test('should accept version with multiple build metadata identifiers', () => {
      // GIVEN: A version with multiple dot-separated build metadata identifiers
      const version = '1.0.0+build.1.sha.abc123'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0+build.1.sha.abc123')
    })

    test('should accept version with hyphenated build metadata', () => {
      // GIVEN: A version with hyphens in build metadata
      const version = '1.0.0+build-123'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0+build-123')
    })
  })

  describe('Valid versions - Combined pre-release and build metadata', () => {
    test('should accept version with pre-release and build metadata', () => {
      // GIVEN: A version with both pre-release identifier and build metadata
      const version = '1.0.0-alpha+001'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-alpha+001')
    })

    test('should accept version with complex pre-release and build metadata', () => {
      // GIVEN: A version with complex pre-release and build metadata
      const version = '1.0.0-beta.1+build.20130313'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-beta.1+build.20130313')
    })

    test('should accept version with multiple identifiers in both parts', () => {
      // GIVEN: A version with multiple identifiers in pre-release and build
      const version = '1.0.0-rc.1.alpha+build.123.sha.abc'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-rc.1.alpha+build.123.sha.abc')
    })
  })

  describe('Invalid versions - Leading zeros', () => {
    test('should reject version with leading zero in major', () => {
      // GIVEN: A version with leading zero in major version
      const invalidVersion = '01.0.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with leading zero in minor', () => {
      // GIVEN: A version with leading zero in minor version
      const invalidVersion = '1.01.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with leading zero in patch', () => {
      // GIVEN: A version with leading zero in patch version
      const invalidVersion = '1.0.01'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with multiple leading zeros', () => {
      // GIVEN: A version with multiple leading zeros
      const invalidVersion = '001.002.003'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })
  })

  describe('Invalid versions - Missing components', () => {
    test('should reject version with only major and minor', () => {
      // GIVEN: A version missing the patch component
      const invalidVersion = '1.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with only major', () => {
      // GIVEN: A version with only major component
      const invalidVersion = '1'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject empty version', () => {
      // GIVEN: An empty version string
      const invalidVersion = ''

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should provide helpful error message for empty version', () => {
      // GIVEN: An empty version string
      const invalidVersion = ''

      // WHEN: The version is validated against the schema
      try {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // THEN: Error should mention minimum format
        expect(error).toBeInstanceOf(ParseResult.ParseError)
        const message = String(error)
        expect(message).toContain('0.0.0')
      }
    })
  })

  describe('Invalid versions - Non-numeric components', () => {
    test('should reject version with letter in major', () => {
      // GIVEN: A version with letter in major component
      const invalidVersion = 'x.0.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with letter in minor', () => {
      // GIVEN: A version with letter in minor component
      const invalidVersion = '1.x.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with letter in patch', () => {
      // GIVEN: A version with letter in patch component
      const invalidVersion = '1.0.x'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with wildcard', () => {
      // GIVEN: A version with wildcard character
      const invalidVersion = '1.0.*'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })
  })

  describe('Invalid versions - Invalid format', () => {
    test('should reject version with spaces', () => {
      // GIVEN: A version with spaces
      const invalidVersion = '1.0.0 beta'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with leading spaces', () => {
      // GIVEN: A version with leading space
      const invalidVersion = ' 1.0.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with trailing spaces', () => {
      // GIVEN: A version with trailing space
      const invalidVersion = '1.0.0 '

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with v prefix', () => {
      // GIVEN: A version with "v" prefix
      const invalidVersion = 'v1.0.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with invalid separator', () => {
      // GIVEN: A version with underscore separator
      const invalidVersion = '1_0_0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject negative version numbers', () => {
      // GIVEN: A version with negative number
      const invalidVersion = '-1.0.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })
  })

  describe('Invalid data - Wrong types', () => {
    test('should reject non-string version', () => {
      // GIVEN: A number instead of a string
      const invalidInput = 1.0

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject null values', () => {
      // GIVEN: A null value
      const invalidInput = null

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject undefined values', () => {
      // GIVEN: An undefined value
      const invalidInput = undefined

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject array value', () => {
      // GIVEN: An array instead of a string
      const invalidInput = ['1.0.0']

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidInput as any)
      }).toThrow()
    })

    test('should reject object value', () => {
      // GIVEN: An object instead of a string
      const invalidInput = { version: '1.0.0' }

      // WHEN: The value is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidInput as any)
      }).toThrow()
    })
  })

  describe('Edge cases', () => {
    test('should accept version with maximum standard digits', () => {
      // GIVEN: A version with very large numbers (edge case for large projects)
      const version = '999999999.999999999.999999999'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('999999999.999999999.999999999')
    })

    test('should accept pre-release with only numbers', () => {
      // GIVEN: A pre-release identifier with only numbers
      const version = '1.0.0-123'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0-123')
    })

    test('should accept build metadata with only numbers', () => {
      // GIVEN: Build metadata with only numbers
      const version = '1.0.0+123'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0+123')
    })

    test('should reject version with empty pre-release', () => {
      // GIVEN: A version with empty pre-release identifier
      const invalidVersion = '1.0.0-'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with empty build metadata', () => {
      // GIVEN: A version with empty build metadata
      const invalidVersion = '1.0.0+'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })

    test('should reject version with double dots', () => {
      // GIVEN: A version with double dots
      const invalidVersion = '1..0.0'

      // WHEN: The version is validated against the schema
      // THEN: Validation should throw an error
      expect(() => {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
      }).toThrow()
    })
  })

  describe('Type inference', () => {
    test('should have correct TypeScript type', () => {
      // GIVEN: A valid semantic version
      const version = '1.0.0'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: TypeScript should infer the result as string type
      const typedVersion: string = result
      expect(typedVersion).toBe('1.0.0')
    })
  })

  describe('Encoding', () => {
    test('should encode valid version', () => {
      // GIVEN: A valid semantic version
      const version = '1.0.0'

      // WHEN: The version is encoded using the schema
      const encoded = Schema.encodeSync(VersionSchema)(version)

      // THEN: The encoded value should match the original version
      expect(encoded).toBe('1.0.0')
    })

    test('should encode complex version', () => {
      // GIVEN: A complex version with pre-release and build metadata
      const version = '1.0.0-beta.1+build.123'

      // WHEN: The version is encoded using the schema
      const encoded = Schema.encodeSync(VersionSchema)(version)

      // THEN: The encoded value should match the original version
      expect(encoded).toBe('1.0.0-beta.1+build.123')
    })
  })

  describe('Real-world examples', () => {
    test('should validate npm package version', () => {
      // GIVEN: A typical npm package version
      const version = '2.14.5'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('2.14.5')
    })

    test('should validate pre-release npm package version', () => {
      // GIVEN: A pre-release npm package version
      const version = '3.0.0-rc.2'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('3.0.0-rc.2')
    })

    test('should validate development version', () => {
      // GIVEN: A development version
      const version = '0.1.0-dev'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('0.1.0-dev')
    })

    test('should validate stable release version', () => {
      // GIVEN: A stable release version
      const version = '1.0.0'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('1.0.0')
    })

    test('should validate version with CI build metadata', () => {
      // GIVEN: A version with CI build metadata
      const version = '2.0.0+build.20241016.1'

      // WHEN: The version is validated against the schema
      const result = Schema.decodeUnknownSync(VersionSchema)(version)

      // THEN: The version should be accepted
      expect(result).toBe('2.0.0+build.20241016.1')
    })
  })

  describe('Error messages', () => {
    test('should provide helpful error message for invalid format', () => {
      // GIVEN: An invalid version format (meets length but wrong pattern)
      const invalidVersion = 'x.y.z'

      // WHEN: The version is validated against the schema
      try {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // THEN: Error should mention SemVer format
        expect(error).toBeInstanceOf(ParseResult.ParseError)
        const message = String(error)
        expect(message).toContain('Semantic Versioning')
      }
    })

    test('should provide helpful error message for leading zeros', () => {
      // GIVEN: A version with leading zeros
      const invalidVersion = '01.0.0'

      // WHEN: The version is validated against the schema
      try {
        Schema.decodeUnknownSync(VersionSchema)(invalidVersion)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // THEN: Error should mention leading zeros
        expect(error).toBeInstanceOf(ParseResult.ParseError)
        const message = String(error)
        expect(message).toContain('No leading zeros allowed')
      }
    })
  })
})
