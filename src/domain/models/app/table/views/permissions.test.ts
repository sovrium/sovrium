/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  ViewPermissionsSchema,
  RoleBasedViewPermissionsSchema,
  PublicViewPermissionsSchema,
} from './permissions'

describe('ViewPermissionsSchema', () => {
  describe('Role-Based Permissions', () => {
    test('should accept object with read and write arrays', () => {
      // GIVEN: Permissions with read/write arrays
      const permissions = { read: ['admin', 'member'], write: ['admin'] }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should accept read-only permissions', () => {
      // GIVEN: Permissions with only read array
      const permissions = { read: ['admin', 'member', 'viewer'] }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should accept write-only permissions', () => {
      // GIVEN: Permissions with only write array
      const permissions = { write: ['admin'] }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should accept empty object (no restrictions)', () => {
      // GIVEN: Empty permissions object
      const permissions = {}

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual({})
    })

    test('should accept single role in array', () => {
      // GIVEN: Single role in read array
      const permissions = { read: ['admin'] }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })
  })

  describe('Public Permissions', () => {
    test('should accept public: true', () => {
      // GIVEN: Public permissions
      const permissions = { public: true } as const

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should strip public: false and return empty object', () => {
      // GIVEN: Public set to false (not a valid PublicViewPermissions)
      const permissions = { public: false }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: Effect Schema strips unknown/invalid properties, returning {}
      // which matches RoleBasedViewPermissionsSchema (no restrictions)
      expect(result).toEqual({})
    })
  })

  describe('Invalid Permissions (Rejected)', () => {
    test('should reject null', () => {
      // GIVEN: Null permissions
      const permissions = null

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject string values', () => {
      // GIVEN: String permissions
      const permissions = 'admin-only'

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject number values', () => {
      // GIVEN: Number permissions
      const permissions = 5

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject array values', () => {
      // GIVEN: Array permissions
      const permissions = ['read', 'write', 'delete']

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject boolean true at root', () => {
      // GIVEN: Boolean true (not in public property)
      const permissions = true

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)).toThrow()
    })

    test('should strip old allowedRoles format and return empty object', () => {
      // GIVEN: Old allowedRoles format (unknown property)
      const permissions = { allowedRoles: ['admin'] }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: Effect Schema strips unknown properties, returning {}
      // which matches RoleBasedViewPermissionsSchema (no restrictions)
      expect(result).toEqual({})
    })

    test('should strip complex nested objects and return empty object', () => {
      // GIVEN: Complex nested permissions structure (unknown properties)
      const permissions = {
        roles: {
          admin: { read: true, write: true },
        },
      }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)

      // THEN: Effect Schema strips unknown properties, returning {}
      // which matches RoleBasedViewPermissionsSchema (no restrictions)
      expect(result).toEqual({})
    })

    test('should reject non-string array elements in read', () => {
      // GIVEN: Non-string elements in read array
      const permissions = { read: [1, 2, 3] }

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject non-array read value', () => {
      // GIVEN: Non-array read value
      const permissions = { read: 'admin' }

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(ViewPermissionsSchema)(permissions)).toThrow()
    })
  })

  describe('RoleBasedViewPermissionsSchema', () => {
    test('should accept valid role-based permissions', () => {
      // GIVEN: Valid role-based permissions
      const permissions = { read: ['admin', 'member'], write: ['admin'] }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(RoleBasedViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should strip public property and return empty object', () => {
      // GIVEN: Public permissions (unknown property for this schema)
      const permissions = { public: true }

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(RoleBasedViewPermissionsSchema)(permissions)

      // THEN: Effect Schema strips unknown properties, returning {}
      // which is valid (no read/write restrictions)
      expect(result).toEqual({})
    })
  })

  describe('PublicViewPermissionsSchema', () => {
    test('should accept public: true', () => {
      // GIVEN: Public permissions
      const permissions = { public: true } as const

      // WHEN: The permissions are validated against the schema
      const result = Schema.decodeUnknownSync(PublicViewPermissionsSchema)(permissions)

      // THEN: The permissions should be accepted
      expect(result).toEqual(permissions)
    })

    test('should reject role-based permissions', () => {
      // GIVEN: Role-based permissions
      const permissions = { read: ['admin'] }

      // WHEN/THEN: It should throw a ParseError
      expect(() => Schema.decodeUnknownSync(PublicViewPermissionsSchema)(permissions)).toThrow()
    })
  })
})
