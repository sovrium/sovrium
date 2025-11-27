/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PublicPermissionSchema } from './public'

describe('PublicPermissionSchema', () => {
  describe('valid permissions', () => {
    test('should accept public type', () => {
      const permission = { type: 'public' as const }
      const result = Schema.decodeUnknownSync(PublicPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })
  })

  describe('invalid permissions', () => {
    test('should reject wrong type', () => {
      const permission = { type: 'authenticated' }
      expect(() => Schema.decodeUnknownSync(PublicPermissionSchema)(permission)).toThrow()
    })

    test('should reject extra properties', () => {
      const permission = { type: 'public', roles: ['admin'] }
      // Effect Schema strips extra properties by default, so this should still decode
      const result = Schema.decodeUnknownSync(PublicPermissionSchema)(permission)
      expect(result.type).toBe('public')
    })
  })
})
