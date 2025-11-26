/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ViewPermissionsSchema } from './permissions'

describe('ViewPermissionsSchema', () => {
  describe('Valid Permissions (Unknown accepts any value)', () => {
    test('should accept object with read/write arrays', () => {
      // GIVEN: Permissions with read/write arrays
      const permissions = { read: ['admin', 'user'], write: ['admin'] }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should accept public flag', () => {
      // GIVEN: Public permissions
      const permissions = { public: true }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should accept null', () => {
      // GIVEN: Null permissions
      const permissions = null

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toBeNull()
    })

    test('should accept undefined', () => {
      // GIVEN: Undefined permissions
      const permissions = undefined

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toBeUndefined()
    })

    test('should accept string', () => {
      // GIVEN: String permissions
      const permissions = 'admin-only'

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toBe('admin-only')
    })

    test('should accept number', () => {
      // GIVEN: Number permissions (e.g., permission level)
      const permissions = 5

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toBe(5)
    })

    test('should accept array', () => {
      // GIVEN: Array permissions
      const permissions = ['read', 'write', 'delete']

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should accept complex nested object', () => {
      // GIVEN: Complex nested permissions
      const permissions = {
        roles: {
          admin: { read: true, write: true, delete: true },
          user: { read: true, write: false, delete: false },
        },
        users: ['user-123', 'user-456'],
      }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should accept boolean', () => {
      // GIVEN: Boolean permissions
      const permissions = true

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toBe(true)
    })

    test('should accept empty object', () => {
      // GIVEN: Empty object permissions
      const permissions = {}

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual({})
    })
  })

  describe('Type Behavior', () => {
    test('should preserve original type for objects', () => {
      // GIVEN: An object
      const permissions = { role: 'admin' }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The type should be preserved
      expect(typeof result).toBe('object')
      expect(result).not.toBeNull()
    })

    test('should preserve original type for primitives', () => {
      // GIVEN: A string
      const permissions = 'public'

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The type should be preserved
      expect(typeof result).toBe('string')
    })
  })
})
