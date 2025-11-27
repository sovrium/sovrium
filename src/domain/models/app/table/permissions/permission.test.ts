/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { TablePermissionSchema } from './permission'

describe('TablePermissionSchema', () => {
  describe('valid permissions (union)', () => {
    test('should accept public permission', () => {
      const permission = { type: 'public' as const }
      const result = Schema.decodeUnknownSync(TablePermissionSchema)(permission)
      expect(result).toEqual(permission)
    })

    test('should accept authenticated permission', () => {
      const permission = { type: 'authenticated' as const }
      const result = Schema.decodeUnknownSync(TablePermissionSchema)(permission)
      expect(result).toEqual(permission)
    })

    test('should accept roles permission', () => {
      const permission = { type: 'roles' as const, roles: ['admin'] }
      const result = Schema.decodeUnknownSync(TablePermissionSchema)(permission)
      expect(result).toEqual(permission)
    })

    test('should accept owner permission', () => {
      const permission = { type: 'owner' as const, field: 'owner_id' }
      const result = Schema.decodeUnknownSync(TablePermissionSchema)(permission)
      expect(result).toEqual(permission)
    })
  })

  describe('invalid permissions', () => {
    test('should reject unknown type', () => {
      const permission = { type: 'unknown' }
      expect(() => Schema.decodeUnknownSync(TablePermissionSchema)(permission)).toThrow()
    })

    test('should reject missing type', () => {
      const permission = { roles: ['admin'] }
      expect(() => Schema.decodeUnknownSync(TablePermissionSchema)(permission)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(TablePermissionSchema)(null)).toThrow()
    })
  })
})
