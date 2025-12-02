/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { AdminConfigSchema } from './admin'

describe('AdminConfigSchema', () => {
  describe('boolean configuration', () => {
    test('should accept true', () => {
      const result = Schema.decodeUnknownSync(AdminConfigSchema)(true)
      expect(result).toBe(true)
    })

    test('should accept false', () => {
      const result = Schema.decodeUnknownSync(AdminConfigSchema)(false)
      expect(result).toBe(false)
    })
  })

  describe('object configuration', () => {
    test('should accept empty object', () => {
      const result = Schema.decodeUnknownSync(AdminConfigSchema)({})
      expect(result).toEqual({})
    })

    test('should accept impersonation option', () => {
      const result = Schema.decodeUnknownSync(AdminConfigSchema)({ impersonation: true })
      expect(result).toEqual({ impersonation: true })
    })

    test('should accept userManagement option', () => {
      const result = Schema.decodeUnknownSync(AdminConfigSchema)({ userManagement: true })
      expect(result).toEqual({ userManagement: true })
    })

    test('should accept both options', () => {
      const result = Schema.decodeUnknownSync(AdminConfigSchema)({
        impersonation: true,
        userManagement: false,
      })
      expect(result).toEqual({ impersonation: true, userManagement: false })
    })
  })

  describe('invalid configurations', () => {
    test('should reject string', () => {
      expect(() => Schema.decodeUnknownSync(AdminConfigSchema)('admin')).toThrow()
    })

    test('should reject number', () => {
      expect(() => Schema.decodeUnknownSync(AdminConfigSchema)(123)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(AdminConfigSchema)(null)).toThrow()
    })

    test('should reject array', () => {
      expect(() => Schema.decodeUnknownSync(AdminConfigSchema)(['admin'])).toThrow()
    })
  })
})
