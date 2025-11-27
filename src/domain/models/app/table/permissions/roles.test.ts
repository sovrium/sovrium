/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { RolesPermissionSchema } from './roles'

describe('RolesPermissionSchema', () => {
  describe('valid permissions', () => {
    test('should accept single role', () => {
      const permission = { type: 'roles' as const, roles: ['admin'] }
      const result = Schema.decodeUnknownSync(RolesPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })

    test('should accept multiple roles', () => {
      const permission = { type: 'roles' as const, roles: ['admin', 'member', 'editor'] }
      const result = Schema.decodeUnknownSync(RolesPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })
  })

  describe('invalid permissions', () => {
    test('should reject empty roles array', () => {
      const permission = { type: 'roles', roles: [] }
      expect(() => Schema.decodeUnknownSync(RolesPermissionSchema)(permission)).toThrow()
    })

    test('should reject missing roles', () => {
      const permission = { type: 'roles' }
      expect(() => Schema.decodeUnknownSync(RolesPermissionSchema)(permission)).toThrow()
    })

    test('should reject wrong type', () => {
      const permission = { type: 'public', roles: ['admin'] }
      expect(() => Schema.decodeUnknownSync(RolesPermissionSchema)(permission)).toThrow()
    })

    test('should reject non-string roles', () => {
      const permission = { type: 'roles', roles: [1, 2, 3] }
      expect(() => Schema.decodeUnknownSync(RolesPermissionSchema)(permission)).toThrow()
    })
  })
})
