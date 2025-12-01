/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Re-implementation of helper functions for testing
 * These are internal functions in schema-initializer.ts that we need to test
 */

/**
 * Check if field is a user reference field (created-by, updated-by)
 */
const isUserReferenceField = (field: Fields[number]): boolean =>
  field.type === 'created-by' || field.type === 'updated-by'

/**
 * Check if field is a user field
 */
const isUserField = (field: Fields[number]): boolean => field.type === 'user'

/**
 * Check if any table needs the users table for foreign keys
 */
const needsUsersTable = (tables: readonly Table[]): boolean =>
  tables.some((table) =>
    table.fields.some((field) => isUserReferenceField(field) || isUserField(field))
  )

/**
 * Check if any table has updated-by fields that need the trigger function
 */
const needsUpdatedByTrigger = (tables: readonly Table[]): boolean =>
  tables.some((table) => table.fields.some((field) => field.type === 'updated-by'))

/**
 * Better Auth system tables that should never be dropped
 */
const PROTECTED_SYSTEM_TABLES = new Set([
  'users',
  'sessions',
  'accounts',
  'verifications',
  'organizations',
  'members',
  'invitations',
])

describe('schema-initializer helpers', () => {
  describe('PROTECTED_SYSTEM_TABLES', () => {
    test('contains expected Better Auth tables', () => {
      // Then
      expect(PROTECTED_SYSTEM_TABLES.has('users')).toBe(true)
      expect(PROTECTED_SYSTEM_TABLES.has('sessions')).toBe(true)
      expect(PROTECTED_SYSTEM_TABLES.has('accounts')).toBe(true)
      expect(PROTECTED_SYSTEM_TABLES.has('verifications')).toBe(true)
      expect(PROTECTED_SYSTEM_TABLES.has('organizations')).toBe(true)
      expect(PROTECTED_SYSTEM_TABLES.has('members')).toBe(true)
      expect(PROTECTED_SYSTEM_TABLES.has('invitations')).toBe(true)
    })

    test('has correct size (7 tables)', () => {
      // Then
      expect(PROTECTED_SYSTEM_TABLES.size).toBe(7)
    })

    test('does not contain application tables', () => {
      // Then
      expect(PROTECTED_SYSTEM_TABLES.has('posts')).toBe(false)
      expect(PROTECTED_SYSTEM_TABLES.has('tasks')).toBe(false)
      expect(PROTECTED_SYSTEM_TABLES.has('products')).toBe(false)
    })

    test('is case-sensitive', () => {
      // Then
      expect(PROTECTED_SYSTEM_TABLES.has('USERS')).toBe(false)
      expect(PROTECTED_SYSTEM_TABLES.has('Users')).toBe(false)
      expect(PROTECTED_SYSTEM_TABLES.has('users')).toBe(true)
    })
  })

  describe('needsUsersTable', () => {
    test('returns true when table has user field', () => {
      // Given
      const tables = [
        {
          name: 'posts',
          fields: [
            { name: 'title', type: 'single-line-text' },
            { name: 'author', type: 'user' },
          ],
        },
      ] as any as readonly Table[]

      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns true when table has created-by field', () => {
      // Given
      const tables = [
        {
          name: 'tasks',
          fields: [
            { name: 'title', type: 'single-line-text' },
            { name: 'created_by', type: 'created-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns true when table has updated-by field', () => {
      // Given
      const tables = [
        {
          name: 'documents',
          fields: [
            { name: 'content', type: 'long-text' },
            { name: 'updated_by', type: 'updated-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns true when multiple tables have user fields', () => {
      // Given
      const tables = [
        { name: 'posts', fields: [{ name: 'author', type: 'user' }] },
        {
          name: 'comments',
          fields: [
            { name: 'author', type: 'user' },
            { name: 'created_by', type: 'created-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns false when no tables have user fields', () => {
      // Given
      const tables = [
        {
          name: 'products',
          fields: [
            { name: 'name', type: 'single-line-text' },
            { name: 'price', type: 'decimal' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(false)
    })

    test('returns false when tables array is empty', () => {
      // Given
      const tables: readonly Table[] = []

      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(false)
    })

    test('returns true when one of many tables has user field', () => {
      // Given
      const tables = [
        { name: 'products', fields: [{ name: 'name', type: 'single-line-text' }] },
        { name: 'categories', fields: [{ name: 'title', type: 'single-line-text' }] },
        { name: 'posts', fields: [{ name: 'author', type: 'user' }] },
      ] as any as readonly Table[]
      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns true when field has all user-related types', () => {
      // Given
      const tables = [
        {
          name: 'audit_log',
          fields: [
            { name: 'user', type: 'user' },
            { name: 'created_by', type: 'created-by' },
            { name: 'updated_by', type: 'updated-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUsersTable(tables)

      // Then
      expect(result).toBe(true)
    })
  })

  describe('needsUpdatedByTrigger', () => {
    test('returns true when table has updated-by field', () => {
      // Given
      const tables = [
        {
          name: 'posts',
          fields: [
            { name: 'title', type: 'single-line-text' },
            { name: 'updated_by', type: 'updated-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns true when multiple tables have updated-by fields', () => {
      // Given
      const tables = [
        { name: 'posts', fields: [{ name: 'updated_by', type: 'updated-by' }] },
        { name: 'comments', fields: [{ name: 'updated_by', type: 'updated-by' }] },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns false when no tables have updated-by field', () => {
      // Given
      const tables = [
        {
          name: 'products',
          fields: [
            { name: 'name', type: 'single-line-text' },
            { name: 'price', type: 'decimal' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(false)
    })

    test('returns false when tables only have created-by (not updated-by)', () => {
      // Given
      const tables = [
        { name: 'posts', fields: [{ name: 'created_by', type: 'created-by' }] },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(false)
    })

    test('returns false when tables only have user field (not updated-by)', () => {
      // Given
      const tables = [
        { name: 'posts', fields: [{ name: 'author', type: 'user' }] },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(false)
    })

    test('returns false when tables array is empty', () => {
      // Given
      const tables: readonly Table[] = []

      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(false)
    })

    test('returns true when one of many tables has updated-by field', () => {
      // Given
      const tables = [
        { name: 'products', fields: [{ name: 'name', type: 'single-line-text' }] },
        { name: 'categories', fields: [{ name: 'title', type: 'single-line-text' }] },
        { name: 'posts', fields: [{ name: 'updated_by', type: 'updated-by' }] },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns true when table has both created-by and updated-by', () => {
      // Given
      const tables = [
        {
          name: 'documents',
          fields: [
            { name: 'created_by', type: 'created-by' },
            { name: 'updated_by', type: 'updated-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(true)
    })

    test('returns true when multiple updated-by fields exist in same table', () => {
      // Given
      const tables = [
        {
          name: 'workflow',
          fields: [
            { name: 'last_modified_by', type: 'updated-by' },
            { name: 'approved_by', type: 'updated-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const result = needsUpdatedByTrigger(tables)

      // Then
      expect(result).toBe(true)
    })
  })

  describe('Integration: needsUsersTable and needsUpdatedByTrigger', () => {
    test('both return true when table has all user field types', () => {
      // Given
      const tables = [
        {
          name: 'audit_log',
          fields: [
            { name: 'user', type: 'user' },
            { name: 'created_by', type: 'created-by' },
            { name: 'updated_by', type: 'updated-by' },
          ],
        },
      ] as any as readonly Table[]
      // When
      const needsUsers = needsUsersTable(tables)
      const needsTrigger = needsUpdatedByTrigger(tables)

      // Then
      expect(needsUsers).toBe(true)
      expect(needsTrigger).toBe(true)
    })

    test('needsUsersTable true but needsUpdatedByTrigger false when only user field', () => {
      // Given
      const tables = [
        { name: 'posts', fields: [{ name: 'author', type: 'user' }] },
      ] as any as readonly Table[]
      // When
      const needsUsers = needsUsersTable(tables)
      const needsTrigger = needsUpdatedByTrigger(tables)

      // Then
      expect(needsUsers).toBe(true)
      expect(needsTrigger).toBe(false)
    })

    test('both return false when no user-related fields', () => {
      // Given
      const tables = [
        { name: 'products', fields: [{ name: 'name', type: 'single-line-text' }] },
      ] as any as readonly Table[]
      // When
      const needsUsers = needsUsersTable(tables)
      const needsTrigger = needsUpdatedByTrigger(tables)

      // Then
      expect(needsUsers).toBe(false)
      expect(needsTrigger).toBe(false)
    })
  })
})
