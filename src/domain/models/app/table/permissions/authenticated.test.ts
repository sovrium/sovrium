/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { AuthenticatedPermissionSchema } from './authenticated'

describe('AuthenticatedPermissionSchema', () => {
  describe('valid permissions', () => {
    test('should accept authenticated type', () => {
      const permission = { type: 'authenticated' as const }
      const result = Schema.decodeUnknownSync(AuthenticatedPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })
  })

  describe('invalid permissions', () => {
    test('should reject wrong type', () => {
      const permission = { type: 'public' }
      expect(() => Schema.decodeUnknownSync(AuthenticatedPermissionSchema)(permission)).toThrow()
    })
  })
})
