/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import {
  hasPermission,
  isAdminRole,
  checkPermissionWithAdminOverride,
  evaluateTablePermissions,
  evaluateFieldPermissions,
  hasCreatePermission,
  hasDeletePermission,
} from './permissions'

describe('permissions', () => {
  describe('hasPermission', () => {
    test('should return true for public permission', () => {
      const result = hasPermission({ type: 'public' }, 'member')
      expect(result).toBe(true)
    })

    test('should return true for authenticated permission', () => {
      const result = hasPermission({ type: 'authenticated' }, 'viewer')
      expect(result).toBe(true)
    })

    test('should return true for roles permission when role matches', () => {
      const result = hasPermission({ type: 'roles', roles: ['admin', 'member'] }, 'admin')
      expect(result).toBe(true)
    })

    test('should return false for roles permission when role does not match', () => {
      const result = hasPermission({ type: 'roles', roles: ['admin'] }, 'viewer')
      expect(result).toBe(false)
    })

    test('should return true for owner permission', () => {
      const result = hasPermission({ type: 'owner' }, 'member')
      expect(result).toBe(true)
    })

    test('should return false for undefined permission', () => {
      const result = hasPermission(undefined, 'member')
      expect(result).toBe(false)
    })

    test('should return false for roles without roles array', () => {
      const result = hasPermission({ type: 'roles' }, 'member')
      expect(result).toBe(false)
    })
  })

  describe('isAdminRole', () => {
    test('should return true for admin role', () => {
      expect(isAdminRole('admin')).toBe(true)
    })

    test('should return true for owner role', () => {
      expect(isAdminRole('owner')).toBe(true)
    })

    test('should return false for member role', () => {
      expect(isAdminRole('member')).toBe(false)
    })

    test('should return false for viewer role', () => {
      expect(isAdminRole('viewer')).toBe(false)
    })
  })

  describe('checkPermissionWithAdminOverride', () => {
    test('should return true when isAdmin is true regardless of permission', () => {
      const result = checkPermissionWithAdminOverride(
        true,
        { type: 'roles', roles: ['viewer'] },
        'admin'
      )
      expect(result).toBe(true)
    })

    test('should check permission when isAdmin is false', () => {
      const result = checkPermissionWithAdminOverride(
        false,
        { type: 'roles', roles: ['member'] },
        'member'
      )
      expect(result).toBe(true)
    })

    test('should return false when not admin and permission denied', () => {
      const result = checkPermissionWithAdminOverride(
        false,
        { type: 'roles', roles: ['admin'] },
        'member'
      )
      expect(result).toBe(false)
    })
  })

  describe('evaluateTablePermissions', () => {
    test('should grant all permissions for admin role', () => {
      const permissions = evaluateTablePermissions(undefined, 'admin', true)

      expect(permissions.read).toBe(true)
      expect(permissions.create).toBe(true)
      expect(permissions.update).toBe(true)
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- Accessing property, not Drizzle delete operation
      expect(permissions.delete).toBe(true)
    })

    test('should evaluate role-based permissions for non-admin', () => {
      const tablePerms = {
        read: { type: 'authenticated' as const },
        create: { type: 'roles' as const, roles: ['admin', 'member'] },
        update: { type: 'roles' as const, roles: ['admin'] },
        delete: { type: 'roles' as const, roles: ['owner'] },
      }

      const permissions = evaluateTablePermissions(tablePerms, 'member', false)

      expect(permissions.read).toBe(true)
      expect(permissions.create).toBe(true)
      expect(permissions.update).toBe(false)
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- Accessing property, not Drizzle delete operation
      expect(permissions.delete).toBe(false)
    })
  })

  describe('evaluateFieldPermissions', () => {
    test('should grant all permissions for admin', () => {
      const fieldPerms = [
        { field: 'email', read: { type: 'roles' as const, roles: ['admin'] }, write: undefined },
      ]

      const permissions = evaluateFieldPermissions(fieldPerms, 'admin', true)

      expect(permissions.email?.read).toBe(true)
      expect(permissions.email?.write).toBe(true)
    })

    test('should evaluate field-level permissions for non-admin', () => {
      const fieldPerms = [
        {
          field: 'email',
          read: { type: 'authenticated' as const },
          write: { type: 'roles' as const, roles: ['admin'] },
        },
        {
          field: 'password',
          read: { type: 'roles' as const, roles: ['owner'] },
          write: { type: 'roles' as const, roles: ['owner'] },
        },
      ]

      const permissions = evaluateFieldPermissions(fieldPerms, 'member', false)

      expect(permissions.email?.read).toBe(true)
      expect(permissions.email?.write).toBe(false)
      expect(permissions.password?.read).toBe(false)
      expect(permissions.password?.write).toBe(false)
    })

    test('should return empty object when no field permissions defined', () => {
      const permissions = evaluateFieldPermissions(undefined, 'member', false)

      expect(permissions).toEqual({})
    })
  })

  describe('hasCreatePermission', () => {
    test('should return true when create permission is not roles-based', () => {
      const table = { permissions: { create: { type: 'authenticated' as const } } }

      const hasPermission = hasCreatePermission(table, 'member')

      expect(hasPermission).toBe(true)
    })

    test('should return true when role is in allowed roles', () => {
      const table = {
        permissions: { create: { type: 'roles' as const, roles: ['admin', 'member'] } },
      }

      const hasPermission = hasCreatePermission(table, 'member')

      expect(hasPermission).toBe(true)
    })

    test('should return false when role is not in allowed roles', () => {
      const table = { permissions: { create: { type: 'roles' as const, roles: ['admin'] } } }

      const hasPermission = hasCreatePermission(table, 'member')

      expect(hasPermission).toBe(false)
    })

    test('should return true when no create permission defined', () => {
      const hasPermission = hasCreatePermission(undefined, 'member')

      expect(hasPermission).toBe(true)
    })
  })

  describe('hasDeletePermission', () => {
    test('should return true when delete permission is not roles-based', () => {
      const table = { permissions: { delete: { type: 'authenticated' as const } } }

      const hasPermission = hasDeletePermission(table, 'member')

      expect(hasPermission).toBe(true)
    })

    test('should return true when role is in allowed roles', () => {
      const table = {
        permissions: { delete: { type: 'roles' as const, roles: ['admin', 'owner'] } },
      }

      const hasPermission = hasDeletePermission(table, 'admin')

      expect(hasPermission).toBe(true)
    })

    test('should return false when role is not in allowed roles', () => {
      const table = { permissions: { delete: { type: 'roles' as const, roles: ['owner'] } } }

      const hasPermission = hasDeletePermission(table, 'member')

      expect(hasPermission).toBe(false)
    })

    test('should return true when no delete permission defined', () => {
      const hasPermission = hasDeletePermission(undefined, 'member')

      expect(hasPermission).toBe(true)
    })
  })
})
