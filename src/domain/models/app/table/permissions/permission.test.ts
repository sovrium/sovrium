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
    test('should accept "all" permission', () => {
      const result = Schema.decodeUnknownSync(TablePermissionSchema)('all')
      expect(result).toBe('all')
    })

    test('should accept "authenticated" permission', () => {
      const result = Schema.decodeUnknownSync(TablePermissionSchema)('authenticated')
      expect(result).toBe('authenticated')
    })

    test('should accept roles array permission', () => {
      const result = Schema.decodeUnknownSync(TablePermissionSchema)(['admin'])
      expect(result).toEqual(['admin'])
    })

    test('should accept multiple roles array', () => {
      const result = Schema.decodeUnknownSync(TablePermissionSchema)(['admin', 'member'])
      expect(result).toEqual(['admin', 'member'])
    })
  })

  describe('invalid permissions', () => {
    test('should reject unknown string', () => {
      expect(() => Schema.decodeUnknownSync(TablePermissionSchema)('unknown')).toThrow()
    })

    test('should reject empty array', () => {
      expect(() => Schema.decodeUnknownSync(TablePermissionSchema)([])).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(TablePermissionSchema)(null)).toThrow()
    })

    test('should reject object', () => {
      expect(() => Schema.decodeUnknownSync(TablePermissionSchema)({ type: 'public' })).toThrow()
    })
  })
})
