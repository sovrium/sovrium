/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { TablePermissionsSchema } from '.'

describe('TablePermissionsSchema', () => {
  describe('valid table permissions', () => {
    test('should accept empty permissions object', () => {
      const permissions = {}
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept read-only permission', () => {
      const permissions = { read: { type: 'public' as const } }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept all CRUD permissions', () => {
      const permissions = {
        read: { type: 'roles' as const, roles: ['member'] },
        create: { type: 'roles' as const, roles: ['admin'] },
        update: { type: 'authenticated' as const },
        delete: { type: 'roles' as const, roles: ['admin'] },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept mixed permission types', () => {
      const permissions = {
        read: { type: 'public' as const },
        create: { type: 'roles' as const, roles: ['admin', 'editor'] },
        update: { type: 'authenticated' as const },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })
  })

  describe('invalid table permissions', () => {
    test('should reject invalid permission type', () => {
      const permissions = { read: { type: 'invalid' } }
      expect(() => Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(TablePermissionsSchema)(null)).toThrow()
    })
  })

  describe('organization scoped permissions', () => {
    test('should accept organizationScoped true', () => {
      const permissions = { organizationScoped: true }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.organizationScoped).toBe(true)
    })

    test('should accept organizationScoped false', () => {
      const permissions = { organizationScoped: false }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.organizationScoped).toBe(false)
    })

    test('should accept combined CRUD and organizationScoped', () => {
      const permissions = {
        read: { type: 'authenticated' as const },
        organizationScoped: true,
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.read?.type).toBe('authenticated')
      expect(result.organizationScoped).toBe(true)
    })
  })

  describe('owner permission', () => {
    test('should accept owner permission with field', () => {
      const permissions = {
        update: { type: 'owner' as const, field: 'owner_id' },
        delete: { type: 'owner' as const, field: 'owner_id' },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.update?.type).toBe('owner')
      if (result.update?.type === 'owner') {
        expect(result.update.field).toBe('owner_id')
      }
    })

    test('should accept owner permission with custom field', () => {
      const permissions = {
        read: { type: 'owner' as const, field: 'created_by' },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      if (result.read?.type === 'owner') {
        expect(result.read.field).toBe('created_by')
      }
    })
  })

  describe('real-world use cases', () => {
    test('should accept public read, admin-only write pattern', () => {
      const permissions = {
        read: { type: 'public' as const },
        create: { type: 'roles' as const, roles: ['admin'] },
        update: { type: 'roles' as const, roles: ['admin'] },
        delete: { type: 'roles' as const, roles: ['admin'] },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.read?.type).toBe('public')
      expect(result.create?.type).toBe('roles')
    })

    test('should accept member read, admin create/delete pattern', () => {
      const permissions = {
        read: { type: 'roles' as const, roles: ['member'] },
        create: { type: 'roles' as const, roles: ['admin'] },
        update: { type: 'authenticated' as const },
        delete: { type: 'roles' as const, roles: ['admin'] },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.read?.type).toBe('roles')
      if (result.read?.type === 'roles') {
        expect(result.read.roles).toContain('member')
      }
    })

    test('should accept authenticated-only access pattern', () => {
      const permissions = {
        read: { type: 'authenticated' as const },
        create: { type: 'authenticated' as const },
        update: { type: 'authenticated' as const },
        delete: { type: 'authenticated' as const },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.read?.type).toBe('authenticated')
      expect(result.create?.type).toBe('authenticated')
    })

    test('should accept owner-based access pattern for personal data', () => {
      const permissions = {
        read: { type: 'owner' as const, field: 'user_id' },
        create: { type: 'authenticated' as const },
        update: { type: 'owner' as const, field: 'user_id' },
        delete: { type: 'owner' as const, field: 'user_id' },
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.read?.type).toBe('owner')
      expect(result.create?.type).toBe('authenticated')
      expect(result.update?.type).toBe('owner')
    })
  })
})
