/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewFieldConfigSchema } from './fields'

describe('ViewFieldConfigSchema', () => {
  describe('Valid Field Configs', () => {
    test('should accept minimal field config', () => {
      // GIVEN: A minimal field configuration
      const config = { field: 'name' }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: The config should be accepted
      expect(result).toEqual({ field: 'name' })
    })

    test('should accept field config with visibility true', () => {
      // GIVEN: A field config with visibility true
      const config = { field: 'email', visible: true }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: The config should be accepted
      expect(result).toEqual({ field: 'email', visible: true })
    })

    test('should accept field config with visibility false', () => {
      // GIVEN: A field config with visibility false
      const config = { field: 'password', visible: false }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: The config should be accepted
      expect(result).toEqual({ field: 'password', visible: false })
    })

    test('should accept field config with width', () => {
      // GIVEN: A field config with width
      const config = { field: 'description', width: 300 }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: The config should be accepted
      expect(result).toEqual({ field: 'description', width: 300 })
    })

    test('should accept full field config', () => {
      // GIVEN: A full field configuration
      const config = { field: 'notes', visible: false, width: 200 }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: The config should be accepted
      expect(result).toEqual({ field: 'notes', visible: false, width: 200 })
    })

    test('should accept field config with zero width', () => {
      // GIVEN: A field config with zero width
      const config = { field: 'hidden', width: 0 }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: The config should be accepted
      expect(result).toEqual({ field: 'hidden', width: 0 })
    })

    test('should accept field config with large width', () => {
      // GIVEN: A field config with large width
      const config = { field: 'content', width: 1000 }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: The config should be accepted
      expect(result).toEqual({ field: 'content', width: 1000 })
    })
  })

  describe('Invalid Field Configs', () => {
    test('should reject missing field', () => {
      // GIVEN: A config without field
      const config = { visible: true }

      // WHEN/THEN: The config validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)
      }).toThrow()
    })

    test('should reject null', () => {
      // GIVEN: A null value
      const config = null

      // WHEN/THEN: The config validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)
      }).toThrow()
    })

    test('should reject empty object', () => {
      // GIVEN: An empty object
      const config = {}

      // WHEN/THEN: The config validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)
      }).toThrow()
    })

    test('should reject non-string field', () => {
      // GIVEN: A config with non-string field
      const config = { field: 123, visible: true }

      // WHEN/THEN: The config validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)
      }).toThrow()
    })

    test('should reject non-boolean visible', () => {
      // GIVEN: A config with non-boolean visible
      const config = { field: 'name', visible: 'yes' }

      // WHEN/THEN: The config validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)
      }).toThrow()
    })

    test('should reject non-number width', () => {
      // GIVEN: A config with non-number width
      const config = { field: 'name', width: '200px' }

      // WHEN/THEN: The config validation should fail
      expect(() => {
        Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)
      }).toThrow()
    })
  })

  describe('Type Inference', () => {
    test('should infer ViewFieldConfig type correctly', () => {
      // GIVEN: A valid field config
      const config = { field: 'email', visible: true, width: 250 }

      // WHEN: The config is validated against the schema
      const result = Schema.decodeUnknownSync(ViewFieldConfigSchema)(config)

      // THEN: TypeScript should infer the correct type
      expect(result.field).toBe('email')
      expect(result.visible).toBe(true)
      expect(result.width).toBe(250)
    })
  })
})
