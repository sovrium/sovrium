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
  hasUpdatePermission,
  hasReadPermission,
} from './permission-evaluator'

describe('permission-evaluator', () => {
  describe('hasPermission', () => {
    test('should return true for "all" permission', () => {
      const result = hasPermission('all', 'member')
      expect(result).toBe(true)
    })

    test('should return true for "authenticated" permission', () => {
      const result = hasPermission('authenticated', 'viewer')
      expect(result).toBe(true)
    })

    test('should return true for roles array when role matches', () => {
      const result = hasPermission(['admin', 'member'], 'admin')
      expect(result).toBe(true)
    })

    test('should return false for roles array when role does not match', () => {
      const result = hasPermission(['admin'], 'viewer')
      expect(result).toBe(false)
    })

    test('should return false for undefined permission', () => {
      const result = hasPermission(undefined, 'member')
      expect(result).toBe(false)
    })

    test('should return false for null permission', () => {
      const result = hasPermission(null, 'member')
      expect(result).toBe(false)
    })
  })

  describe('isAdminRole', () => {
    test('should return true for admin role', () => {
      expect(isAdminRole('admin')).toBe(true)
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
      const result = checkPermissionWithAdminOverride(true, ['viewer'], 'admin')
      expect(result).toBe(true)
    })

    test('should check permission when isAdmin is false', () => {
      const result = checkPermissionWithAdminOverride(false, ['member'], 'member')
      expect(result).toBe(true)
    })

    test('should return false when not admin and permission denied', () => {
      const result = checkPermissionWithAdminOverride(false, ['admin'], 'member')
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
        read: 'authenticated' as const,
        create: ['admin', 'member'] as string[],
        update: ['admin'] as string[],
        delete: ['admin'] as string[],
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
      const fieldPerms = [{ field: 'email', read: ['admin'] as string[], write: undefined }]

      const permissions = evaluateFieldPermissions(fieldPerms, 'admin', true)

      expect(permissions.email?.read).toBe(true)
      expect(permissions.email?.write).toBe(true)
    })

    test('should evaluate field-level permissions for non-admin', () => {
      const fieldPerms = [
        {
          field: 'email',
          read: 'authenticated' as const,
          write: ['admin'] as string[],
        },
        {
          field: 'password',
          read: ['admin'] as string[],
          write: ['admin'] as string[],
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
    test('should return true when no create permission defined', () => {
      expect(hasCreatePermission(undefined, 'member')).toBe(true)
    })

    test('should return true when role is in allowed roles', () => {
      const table = { permissions: { create: ['admin', 'member'] } }
      expect(hasCreatePermission(table, 'member')).toBe(true)
    })

    test('should return false when role is not in allowed roles', () => {
      const table = { permissions: { create: ['admin'] } }
      expect(hasCreatePermission(table, 'member')).toBe(false)
    })

    test('should deny viewers by default', () => {
      expect(hasCreatePermission(undefined, 'viewer')).toBe(false)
    })
  })

  describe('hasDeletePermission', () => {
    test('should return true when no delete permission defined for non-viewer', () => {
      expect(hasDeletePermission(undefined, 'member')).toBe(true)
    })

    test('should return true when role is in allowed roles', () => {
      const table = { permissions: { delete: ['admin', 'member'] } }
      expect(hasDeletePermission(table, 'admin')).toBe(true)
    })

    test('should return false when role is not in allowed roles', () => {
      const table = { permissions: { delete: ['admin'] } }
      expect(hasDeletePermission(table, 'member')).toBe(false)
    })

    test('should deny viewers by default', () => {
      expect(hasDeletePermission(undefined, 'viewer')).toBe(false)
    })
  })

  describe('hasUpdatePermission', () => {
    test('should return true when no update permission defined for non-viewer', () => {
      expect(hasUpdatePermission(undefined, 'member')).toBe(true)
    })

    test('should return true when role is in allowed roles', () => {
      const table = { permissions: { update: ['admin', 'member'] } }
      expect(hasUpdatePermission(table, 'member')).toBe(true)
    })

    test('should return false when role is not in allowed roles', () => {
      const table = { permissions: { update: ['admin'] } }
      expect(hasUpdatePermission(table, 'member')).toBe(false)
    })

    test('should deny viewers by default', () => {
      expect(hasUpdatePermission(undefined, 'viewer')).toBe(false)
    })
  })

  describe('hasReadPermission', () => {
    test('should return true when no read permission defined for non-viewer', () => {
      expect(hasReadPermission(undefined, 'member')).toBe(true)
    })

    test('should return true when role is in allowed roles', () => {
      const table = { permissions: { read: ['admin', 'member'] } }
      expect(hasReadPermission(table, 'member')).toBe(true)
    })

    test('should return false when role is not in allowed roles', () => {
      const table = { permissions: { read: ['admin'] } }
      expect(hasReadPermission(table, 'member')).toBe(false)
    })

    test('should deny viewers by default', () => {
      expect(hasReadPermission(undefined, 'viewer')).toBe(false)
    })
  })
})
