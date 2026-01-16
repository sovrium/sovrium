/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { filterReadableFields } from './field-read-filter'
import type { App } from '@/domain/models/app'
import type { TablePermissions } from '@/domain/models/app/table/permissions'

// Mock app factory moved to outer scope
const createMockApp = (fieldPermissions?: unknown[]): App => ({
  name: 'Test App',
  tables: [
    {
      id: 1,
      name: 'users',
      fields: [
        { id: 1, name: 'id', type: 'uuid', required: true, unique: true, indexed: false },
        { id: 2, name: 'email', type: 'text', required: true, unique: true, indexed: false },
        { id: 3, name: 'password', type: 'text', required: true, unique: false, indexed: false },
        { id: 4, name: 'role', type: 'text', required: true, unique: false, indexed: false },
      ],
      primaryKey: { type: 'composite', fields: ['id'] },
      permissions: fieldPermissions
        ? ({
            fields: fieldPermissions,
          } as unknown as TablePermissions)
        : undefined,
    },
  ],
})

describe('filterReadableFields', () => {
  describe('system fields', () => {
    test('should preserve id, created_at, and updated_at fields', () => {
      const app = createMockApp()
      const record = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'viewer',
        userId: 'user-123',
        record,
      })

      expect(filtered.id).toBe('user-123')
      expect(filtered.created_at).toBe('2025-01-01T00:00:00Z')
      expect(filtered.updated_at).toBe('2025-01-01T00:00:00Z')
    })
  })

  describe('no field permissions defined', () => {
    test('should return all fields when no field permissions exist', () => {
      const app = createMockApp()
      const record = { id: 'user-123', email: 'test@example.com', password: 'hashed' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered).toEqual(record)
    })
  })

  describe('public permission', () => {
    test('should allow all users to read public fields', () => {
      const app = createMockApp([{ field: 'email', read: { type: 'public' } }])
      const record = { id: 'user-123', email: 'test@example.com' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'viewer',
        userId: 'user-456',
        record,
      })

      expect(filtered.email).toBe('test@example.com')
    })
  })

  describe('authenticated permission', () => {
    test('should allow authenticated users to read authenticated fields', () => {
      const app = createMockApp([{ field: 'email', read: { type: 'authenticated' } }])
      const record = { id: 'user-123', email: 'test@example.com' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.email).toBe('test@example.com')
    })
  })

  describe('roles permission', () => {
    test('should allow users with matching roles', () => {
      const app = createMockApp([
        { field: 'email', read: { type: 'roles', roles: ['admin', 'member'] } },
      ])
      const record = { id: 'user-123', email: 'test@example.com' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.email).toBe('test@example.com')
    })

    test('should deny users without matching roles', () => {
      const app = createMockApp([{ field: 'password', read: { type: 'roles', roles: ['admin'] } }])
      const record = { id: 'user-123', email: 'test@example.com', password: 'hashed' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.password).toBeUndefined()
    })
  })

  describe('owner permission', () => {
    test('should allow owner to read field when userId matches', () => {
      const app = createMockApp([{ field: 'password', read: { type: 'owner', field: 'user_id' } }])
      const record = { id: 'user-123', password: 'hashed', user_id: 'user-123' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.password).toBe('hashed')
    })

    test('should deny non-owner when userId does not match', () => {
      const app = createMockApp([{ field: 'password', read: { type: 'owner', field: 'user_id' } }])
      const record = { id: 'user-456', password: 'hashed', user_id: 'user-456' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.password).toBeUndefined()
    })
  })

  describe('custom permission', () => {
    test('should allow owner based on custom condition', () => {
      const app = createMockApp([
        { field: 'sensitive', read: { type: 'custom', condition: '{userId} = owner_id' } },
      ])
      const record = { id: 'record-1', sensitive: 'data', owner_id: 'user-123' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.sensitive).toBe('data')
    })

    test('should deny non-owner based on custom condition', () => {
      const app = createMockApp([
        { field: 'sensitive', read: { type: 'custom', condition: '{userId} = owner_id' } },
      ])
      const record = { id: 'record-1', sensitive: 'data', owner_id: 'user-456' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.sensitive).toBeUndefined()
    })

    test('should deny for unsupported custom conditions', () => {
      const app = createMockApp([
        { field: 'sensitive', read: { type: 'custom', condition: 'complex condition' } },
      ])
      const record = { id: 'record-1', sensitive: 'data' }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.sensitive).toBeUndefined()
    })
  })

  describe('mixed permissions', () => {
    test('should filter multiple fields with different permissions', () => {
      const app = createMockApp([
        { field: 'email', read: { type: 'public' } },
        { field: 'password', read: { type: 'roles', roles: ['admin'] } },
        { field: 'role', read: { type: 'authenticated' } },
      ])
      const record = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        role: 'member',
      }

      const filtered = filterReadableFields({
        app,
        tableName: 'users',
        userRole: 'member',
        userId: 'user-123',
        record,
      })

      expect(filtered.id).toBe('user-123')
      expect(filtered.email).toBe('test@example.com')
      expect(filtered.password).toBeUndefined()
      expect(filtered.role).toBe('member')
    })
  })
})
