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

  describe('defaultAdmin configuration', () => {
    test('should accept minimal defaultAdmin', () => {
      const input = {
        defaultAdmin: {
          email: 'admin@example.com',
          password: '$ADMIN_PASSWORD',
        },
      }
      const result = Schema.decodeUnknownSync(AdminConfigSchema)(input)
      expect(result).toEqual({
        defaultAdmin: {
          email: 'admin@example.com',
          password: '$ADMIN_PASSWORD',
        },
      })
    })

    test('should accept defaultAdmin with name', () => {
      const input = {
        defaultAdmin: {
          email: 'admin@example.com',
          password: '$ADMIN_PASSWORD',
          name: 'System Admin',
        },
      }
      const result = Schema.decodeUnknownSync(AdminConfigSchema)(input)
      expect(result).toEqual({
        defaultAdmin: {
          email: 'admin@example.com',
          password: '$ADMIN_PASSWORD',
          name: 'System Admin',
        },
      })
    })

    test('should accept defaultAdmin with other options', () => {
      const input = {
        impersonation: true,
        userManagement: true,
        defaultAdmin: {
          email: 'admin@example.com',
          password: '$ADMIN_PASSWORD',
          name: 'Admin User',
        },
      }
      const result = Schema.decodeUnknownSync(AdminConfigSchema)(input)
      expect(result).toEqual({
        impersonation: true,
        userManagement: true,
        defaultAdmin: {
          email: 'admin@example.com',
          password: '$ADMIN_PASSWORD',
          name: 'Admin User',
        },
      })
    })

    test('should reject defaultAdmin with invalid email', () => {
      expect(() =>
        Schema.decodeUnknownSync(AdminConfigSchema)({
          defaultAdmin: {
            email: 'invalid-email',
            password: '$ADMIN_PASSWORD',
          },
        })
      ).toThrow()
    })

    test('should reject defaultAdmin with plaintext password', () => {
      expect(() =>
        Schema.decodeUnknownSync(AdminConfigSchema)({
          defaultAdmin: {
            email: 'admin@example.com',
            password: 'plaintext-password',
          },
        })
      ).toThrow()
    })

    test('should reject defaultAdmin with missing email', () => {
      expect(() =>
        Schema.decodeUnknownSync(AdminConfigSchema)({
          defaultAdmin: {
            password: '$ADMIN_PASSWORD',
          },
        })
      ).toThrow()
    })

    test('should reject defaultAdmin with missing password', () => {
      expect(() =>
        Schema.decodeUnknownSync(AdminConfigSchema)({
          defaultAdmin: {
            email: 'admin@example.com',
          },
        })
      ).toThrow()
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
