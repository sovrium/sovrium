/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  CRUD_TO_SQL_COMMAND,
  isPublicPermission,
  hasOnlyPublicPermissions,
  hasNoPermissions,
  hasExplicitEmptyPermissions,
  hasOwnerPermissions,
  hasAuthenticatedPermissions,
  hasRolePermissions,
  hasRecordLevelPermissions,
  hasMixedPermissions,
  extractDatabaseRoles,
} from './rls-permission-checks'
import type { Table } from '@/domain/models/app/table'

describe('CRUD_TO_SQL_COMMAND', () => {
  test('maps CRUD operations to SQL commands', () => {
    expect(CRUD_TO_SQL_COMMAND.read).toBe('SELECT')
    expect(CRUD_TO_SQL_COMMAND.create).toBe('INSERT')
    expect(CRUD_TO_SQL_COMMAND.update).toBe('UPDATE')
    // eslint-disable-next-line drizzle/enforce-delete-with-where
    expect(CRUD_TO_SQL_COMMAND.delete).toBe('DELETE')
  })
})

describe('isPublicPermission', () => {
  test('returns true for public permission', () => {
    expect(isPublicPermission({ type: 'public' })).toBe(true)
  })

  test('returns false for non-public permissions', () => {
    expect(isPublicPermission({ type: 'authenticated' })).toBe(false)
    expect(isPublicPermission({ type: 'owner', field: 'user_id' })).toBe(false)
    expect(isPublicPermission({ type: 'roles', roles: ['admin'] })).toBe(false)
  })

  test('returns false for undefined permission', () => {
    expect(isPublicPermission(undefined)).toBe(false)
  })
})

describe('hasOnlyPublicPermissions', () => {
  test('returns true when all permissions are public', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
        create: { type: 'public' },
        update: { type: 'public' },
        delete: { type: 'public' },
      },
    } as any

    expect(hasOnlyPublicPermissions(table)).toBe(true)
  })

  test('returns true when some operations are public and others undefined', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
      },
    } as any

    expect(hasOnlyPublicPermissions(table)).toBe(true)
  })

  test('returns false when any permission is not public', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
        create: { type: 'authenticated' }, // Not public
      },
    } as any

    expect(hasOnlyPublicPermissions(table)).toBe(false)
  })

  test('returns false when permissions is undefined', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
    } as any

    expect(hasOnlyPublicPermissions(table)).toBe(false)
  })

  test('returns false when no permissions are configured', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {},
    } as any

    expect(hasOnlyPublicPermissions(table)).toBe(false)
  })

  test('returns false when field-level permissions exist', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
        fields: [{ field: 'email', read: ['admin'] }],
      },
    } as any

    expect(hasOnlyPublicPermissions(table)).toBe(false)
  })

  test('returns false when record-level permissions exist', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
        records: [{ formula: { field: 'status', operator: '=', value: 'published' } }],
      },
    } as any

    expect(hasOnlyPublicPermissions(table)).toBe(false)
  })
})

describe('hasNoPermissions', () => {
  test('returns true when permissions is undefined', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
    } as any

    expect(hasNoPermissions(table)).toBe(true)
  })

  test('returns false when permissions object exists', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {},
    } as any

    expect(hasNoPermissions(table)).toBe(false)
  })

  test('returns false when permissions are configured', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
      },
    } as any

    expect(hasNoPermissions(table)).toBe(false)
  })
})

describe('hasExplicitEmptyPermissions', () => {
  test('returns true when permissions is explicitly empty object', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {},
    } as any

    expect(hasExplicitEmptyPermissions(table)).toBe(true)
  })

  test('returns false when permissions is undefined', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
    } as any

    expect(hasExplicitEmptyPermissions(table)).toBe(false)
  })

  test('returns false when any CRUD permission is defined', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
      },
    } as any

    expect(hasExplicitEmptyPermissions(table)).toBe(false)
  })

  test('returns false when field-level permissions exist', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        fields: [{ field: 'email', read: ['admin'] }],
      },
    } as any

    expect(hasExplicitEmptyPermissions(table)).toBe(false)
  })

  test('returns false when record-level permissions exist', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        records: [{ formula: { field: 'status', operator: '=', value: 'published' } }],
      },
    } as any

    expect(hasExplicitEmptyPermissions(table)).toBe(false)
  })

  test('returns true when permissions has empty arrays for fields and records', () => {
    const table: Table = {
      name: 'products',
      slug: 'products',
      fields: [],
      order: 0,
      permissions: {
        fields: [],
        records: [],
      },
    } as any

    expect(hasExplicitEmptyPermissions(table)).toBe(true)
  })
})

describe('hasOwnerPermissions', () => {
  test('returns true when read uses owner permission', () => {
    const table: Table = {
      name: 'tasks',
      slug: 'tasks',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'owner' },
      },
    } as any

    expect(hasOwnerPermissions(table)).toBe(true)
  })

  test('returns true when create uses owner permission', () => {
    const table: Table = {
      name: 'tasks',
      slug: 'tasks',
      fields: [],
      order: 0,
      permissions: {
        create: { type: 'owner' },
      },
    } as any

    expect(hasOwnerPermissions(table)).toBe(true)
  })

  test('returns true when update uses owner permission', () => {
    const table: Table = {
      name: 'tasks',
      slug: 'tasks',
      fields: [],
      order: 0,
      permissions: {
        update: { type: 'owner' },
      },
    } as any

    expect(hasOwnerPermissions(table)).toBe(true)
  })

  test('returns true when delete uses owner permission', () => {
    const table: Table = {
      name: 'tasks',
      slug: 'tasks',
      fields: [],
      order: 0,
      permissions: {
        delete: { type: 'owner' },
      },
    } as any

    expect(hasOwnerPermissions(table)).toBe(true)
  })

  test('returns false when no owner permissions exist', () => {
    const table: Table = {
      name: 'tasks',
      slug: 'tasks',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
      },
    } as any

    expect(hasOwnerPermissions(table)).toBe(false)
  })

  test('returns false when permissions is undefined', () => {
    const table: Table = {
      name: 'tasks',
      slug: 'tasks',
      fields: [],
      order: 0,
    } as any

    expect(hasOwnerPermissions(table)).toBe(false)
  })
})

describe('hasAuthenticatedPermissions', () => {
  test('returns true when read uses authenticated permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'authenticated' },
      },
    } as any

    expect(hasAuthenticatedPermissions(table)).toBe(true)
  })

  test('returns true when create uses authenticated permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        create: { type: 'authenticated' },
      },
    } as any

    expect(hasAuthenticatedPermissions(table)).toBe(true)
  })

  test('returns true when update uses authenticated permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        update: { type: 'authenticated' },
      },
    } as any

    expect(hasAuthenticatedPermissions(table)).toBe(true)
  })

  test('returns true when delete uses authenticated permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        delete: { type: 'authenticated' },
      },
    } as any

    expect(hasAuthenticatedPermissions(table)).toBe(true)
  })

  test('returns false when no authenticated permissions exist', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
      },
    } as any

    expect(hasAuthenticatedPermissions(table)).toBe(false)
  })

  test('returns false when permissions is undefined', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
    } as any

    expect(hasAuthenticatedPermissions(table)).toBe(false)
  })
})

describe('hasRolePermissions', () => {
  test('returns true when read uses role-based permission', () => {
    const table: Table = {
      name: 'users',
      slug: 'users',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'roles', roles: ['admin'] },
      },
    } as any

    expect(hasRolePermissions(table)).toBe(true)
  })

  test('returns true when create uses role-based permission', () => {
    const table: Table = {
      name: 'users',
      slug: 'users',
      fields: [],
      order: 0,
      permissions: {
        create: { type: 'roles', roles: ['admin'] },
      },
    } as any

    expect(hasRolePermissions(table)).toBe(true)
  })

  test('returns true when update uses role-based permission', () => {
    const table: Table = {
      name: 'users',
      slug: 'users',
      fields: [],
      order: 0,
      permissions: {
        update: { type: 'roles', roles: ['admin', 'moderator'] },
      },
    } as any

    expect(hasRolePermissions(table)).toBe(true)
  })

  test('returns true when delete uses role-based permission', () => {
    const table: Table = {
      name: 'users',
      slug: 'users',
      fields: [],
      order: 0,
      permissions: {
        delete: { type: 'roles', roles: ['admin'] },
      },
    } as any

    expect(hasRolePermissions(table)).toBe(true)
  })

  test('returns false when no role-based permissions exist', () => {
    const table: Table = {
      name: 'users',
      slug: 'users',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
      },
    } as any

    expect(hasRolePermissions(table)).toBe(false)
  })

  test('returns false when permissions is undefined', () => {
    const table: Table = {
      name: 'users',
      slug: 'users',
      fields: [],
      order: 0,
    } as any

    expect(hasRolePermissions(table)).toBe(false)
  })
})

describe('hasRecordLevelPermissions', () => {
  test('returns true when record-level permissions are defined', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        records: [{ formula: { field: 'status', operator: '=', value: 'published' } }],
      },
    } as any

    expect(hasRecordLevelPermissions(table)).toBe(true)
  })

  test('returns false when record-level permissions array is empty', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        records: [],
      },
    } as any

    expect(hasRecordLevelPermissions(table)).toBe(false)
  })

  test('returns false when record-level permissions are undefined', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {},
    } as any

    expect(hasRecordLevelPermissions(table)).toBe(false)
  })

  test('returns false when permissions is undefined', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
    } as any

    expect(hasRecordLevelPermissions(table)).toBe(false)
  })
})

describe('hasMixedPermissions', () => {
  test('returns true when different CRUD operations use different permission types', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'authenticated' },
        create: { type: 'roles', roles: ['admin'] }, // Different type
      },
    } as any

    expect(hasMixedPermissions(table)).toBe(true)
  })

  test('returns false when all permissions are the same type', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'authenticated' },
        create: { type: 'authenticated' },
        update: { type: 'authenticated' },
      },
    } as any

    expect(hasMixedPermissions(table)).toBe(false)
  })

  test('returns false when only one non-public permission exists', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'authenticated' },
      },
    } as any

    expect(hasMixedPermissions(table)).toBe(false)
  })

  test('returns false when permissions is undefined', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
    } as any

    expect(hasMixedPermissions(table)).toBe(false)
  })

  test('ignores public permissions when checking for mixing', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
        create: { type: 'authenticated' },
        update: { type: 'authenticated' },
      },
    } as any

    expect(hasMixedPermissions(table)).toBe(false)
  })

  test('returns false when table has record-level permissions', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'authenticated' },
        create: { type: 'roles', roles: ['admin'] },
        records: [{ formula: { field: 'status', operator: '=', value: 'published' } }],
      },
    } as any

    expect(hasMixedPermissions(table)).toBe(false)
  })
})

describe('extractDatabaseRoles', () => {
  test('extracts roles from read permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'roles', roles: ['admin', 'moderator'] },
      },
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.has('admin_user')).toBe(true)
    expect(roles.has('moderator_user')).toBe(true)
    expect(roles.size).toBe(2)
  })

  test('extracts roles from create permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        create: { type: 'roles', roles: ['admin'] },
      },
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.has('admin_user')).toBe(true)
    expect(roles.size).toBe(1)
  })

  test('extracts roles from update permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        update: { type: 'roles', roles: ['editor'] },
      },
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.has('editor_user')).toBe(true)
    expect(roles.size).toBe(1)
  })

  test('extracts roles from delete permission', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        delete: { type: 'roles', roles: ['admin'] },
      },
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.has('admin_user')).toBe(true)
    expect(roles.size).toBe(1)
  })

  test('deduplicates roles from multiple permissions', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'roles', roles: ['admin', 'moderator'] },
        update: { type: 'roles', roles: ['admin'] }, // Duplicate admin
      },
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.has('admin_user')).toBe(true)
    expect(roles.has('moderator_user')).toBe(true)
    expect(roles.size).toBe(2) // Deduplicated
  })

  test('returns empty set when permissions is undefined', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.size).toBe(0)
  })

  test('returns empty set when no role-based permissions exist', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'public' },
        create: { type: 'authenticated' },
      },
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.size).toBe(0)
  })

  test('combines roles from all CRUD operations', () => {
    const table: Table = {
      name: 'posts',
      slug: 'posts',
      fields: [],
      order: 0,
      permissions: {
        read: { type: 'roles', roles: ['viewer'] },
        create: { type: 'roles', roles: ['editor'] },
        update: { type: 'roles', roles: ['editor', 'admin'] },
        delete: { type: 'roles', roles: ['admin'] },
      },
    } as any

    const roles = extractDatabaseRoles(table)
    expect(roles.has('viewer_user')).toBe(true)
    expect(roles.has('editor_user')).toBe(true)
    expect(roles.has('admin_user')).toBe(true)
    expect(roles.size).toBe(3)
  })
})
