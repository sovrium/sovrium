/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, mock } from 'bun:test'
import { Effect } from 'effect'
import { logActivity } from './activity-log-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

// Mock the database module

const mockDbExecute: any = mock(async () => [])

const mockDbInsert: any = mock(() => ({
  values: mock(async () => ({})),
}))

mock.module('@/infrastructure/database', () => ({
  db: {
    execute: mockDbExecute,
    insert: mockDbInsert,
  },
  SessionContextError: class SessionContextError extends Error {
    constructor(message: string, cause?: unknown) {
      super(message)
      this.cause = cause
    }
  },
}))

mock.module('@/infrastructure/database/drizzle/schema/activity-log', () => ({
  activityLogs: {},
}))

describe('logActivity', () => {
  const mockSession: Readonly<Session> = {
    userId: 'user-123',
    token: 'token',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    id: 'session-id',
    ipAddress: null,
    userAgent: null,
    impersonatedBy: null,
  }

  describe('when logging successful operations', () => {
    test('logs create action with after data', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      const insertValuesMock = mock(async () => ({}))
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'create',
        recordId: 'record-789',
        changes: {
          after: { name: 'Alice', email: 'alice@example.com' },
        },
      })

      // Should not throw (Effect.ignore makes it never fail)
      await Effect.runPromise(program)

      // Verify insert was called
      expect(insertValuesMock).toHaveBeenCalled()
    })

    test('logs update action with before and after data', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'posts' }])

      const insertValuesMock = mock(async () => ({}))
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'posts',
        action: 'update',
        recordId: 'post-123',
        changes: {
          before: { title: 'Old Title' },
          after: { title: 'New Title' },
        },
      })

      await Effect.runPromise(program)

      expect(insertValuesMock).toHaveBeenCalled()
    })

    test('logs delete action with before data', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'comments' }])

      const insertValuesMock = mock(async () => ({}))
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'comments',
        action: 'delete',
        recordId: 'comment-456',
        changes: {
          before: { content: 'Deleted comment' },
        },
      })

      await Effect.runPromise(program)

      expect(insertValuesMock).toHaveBeenCalled()
    })

    test('includes session userId in activity log', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'create',
        recordId: 'record-789',
        changes: {
          after: { name: 'Bob' },
        },
      })

      await Effect.runPromise(program)

      expect(capturedValues).toHaveProperty('userId', 'user-123')
    })

    test('includes action type in activity log', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'update',
        recordId: 'record-789',
        changes: {
          before: { name: 'Old' },
          after: { name: 'New' },
        },
      })

      await Effect.runPromise(program)

      expect(capturedValues).toHaveProperty('action', 'update')
    })

    test('includes table name in activity log', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'posts' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'posts',
        action: 'create',
        recordId: 'post-123',
        changes: {
          after: { title: 'New Post' },
        },
      })

      await Effect.runPromise(program)

      expect(capturedValues).toHaveProperty('tableName', 'posts')
    })

    test('includes record ID in activity log', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'delete',
        recordId: 'user-456',
        changes: {
          before: { name: 'Deleted User' },
        },
      })

      await Effect.runPromise(program)

      expect(capturedValues).toHaveProperty('recordId', 'user-456')
    })

    test('includes changes object in activity log', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const changes = {
        before: { status: 'active' },
        after: { status: 'inactive' },
      }

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'update',
        recordId: 'user-789',
        changes,
      })

      await Effect.runPromise(program)

      expect(capturedValues).toHaveProperty('changes')
      expect(capturedValues.changes).toEqual(changes)
    })

    test('generates unique UUID for each activity log entry', async () => {
      mockDbExecute.mockResolvedValue([{ schemaname: 'public', tablename: 'users' }])

      const capturedIds: string[] = []
      const insertValuesMock = mock(async (values: any) => {
        capturedIds.push(values.id)
        return {}
      })
      mockDbInsert.mockReturnValue({ values: insertValuesMock })

      // Log two activities
      const program1 = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'create',
        recordId: 'record-1',
        changes: { after: { name: 'User 1' } },
      })

      const program2 = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'create',
        recordId: 'record-2',
        changes: { after: { name: 'User 2' } },
      })

      await Effect.runPromise(program1)
      await Effect.runPromise(program2)

      // IDs should be different
      expect(capturedIds.length).toBe(2)
      expect(capturedIds[0]).not.toBe(capturedIds[1])

      // Should be valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(capturedIds[0]).toMatch(uuidRegex)
      expect(capturedIds[1]).toMatch(uuidRegex)
    })
  })

  describe('when table is not found in schema', () => {
    test('uses fallback table ID when pg_tables returns empty', async () => {
      // Return empty array (table not found)
      mockDbExecute.mockResolvedValueOnce([])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'unknown_table',
        action: 'create',
        recordId: 'record-123',
        changes: {
          after: { data: 'test' },
        },
      })

      await Effect.runPromise(program)

      // Should use fallback table ID '1'
      expect(capturedValues).toHaveProperty('tableId', '1')
    })
  })

  describe('when database errors occur', () => {
    test('does not throw when pg_tables query fails (Effect.ignore)', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('Database connection failed'))

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'create',
        recordId: 'record-123',
        changes: {
          after: { name: 'Test' },
        },
      })

      // Should not throw (Effect.ignore swallows errors)
      await expect(Effect.runPromise(program)).resolves.toBeUndefined()
    })

    test('does not throw when insert fails (Effect.ignore)', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      const insertValuesMock = mock(async () => {
        throw new Error('Insert failed')
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'create',
        recordId: 'record-123',
        changes: {
          after: { name: 'Test' },
        },
      })

      // Should not throw (Effect.ignore swallows errors)
      await expect(Effect.runPromise(program)).resolves.toBeUndefined()
    })

    test('continues execution even with network timeout', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('Network timeout'))

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'delete',
        recordId: 'record-456',
        changes: {
          before: { name: 'Deleted User' },
        },
      })

      // Should not throw (non-critical operation)
      await expect(Effect.runPromise(program)).resolves.toBeUndefined()
    })

    test('continues execution when schema query fails', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('Schema access denied'))

      const program = logActivity({
        session: mockSession,
        tableName: 'restricted_table',
        action: 'update',
        recordId: 'record-789',
        changes: {
          before: { value: 'old' },
          after: { value: 'new' },
        },
      })

      // Should not throw (Effect.ignore handles all errors)
      await expect(Effect.runPromise(program)).resolves.toBeUndefined()
    })
  })

  describe('when changes object is empty', () => {
    test('logs activity with empty changes object', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'update',
        recordId: 'record-123',
        changes: {}, // Empty changes
      })

      await Effect.runPromise(program)

      expect(capturedValues).toHaveProperty('changes')
      expect(capturedValues.changes).toEqual({})
    })

    test('logs activity with only before data (delete)', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'delete',
        recordId: 'record-123',
        changes: {
          before: { name: 'Deleted User' },
        },
      })

      await Effect.runPromise(program)

      expect(capturedValues.changes).toHaveProperty('before')
      expect(capturedValues.changes).not.toHaveProperty('after')
    })

    test('logs activity with only after data (create)', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'create',
        recordId: 'record-123',
        changes: {
          after: { name: 'New User' },
        },
      })

      await Effect.runPromise(program)

      expect(capturedValues.changes).toHaveProperty('after')
      expect(capturedValues.changes).not.toHaveProperty('before')
    })
  })

  describe('audit trail completeness', () => {
    test('captures all required fields for audit trail', async () => {
      mockDbExecute.mockResolvedValueOnce([{ schemaname: 'public', tablename: 'users' }])

      let capturedValues: any = null
      const insertValuesMock = mock(async (values: any) => {
        capturedValues = values
        return {}
      })
      mockDbInsert.mockReturnValueOnce({ values: insertValuesMock })

      const program = logActivity({
        session: mockSession,
        tableName: 'users',
        action: 'update',
        recordId: 'user-789',
        changes: {
          before: { email: 'old@example.com' },
          after: { email: 'new@example.com' },
        },
      })

      await Effect.runPromise(program)

      // Verify all critical audit fields are present
      expect(capturedValues).toHaveProperty('id')
      expect(capturedValues).toHaveProperty('userId')
      expect(capturedValues).toHaveProperty('action')
      expect(capturedValues).toHaveProperty('tableName')
      expect(capturedValues).toHaveProperty('tableId')
      expect(capturedValues).toHaveProperty('recordId')
      expect(capturedValues).toHaveProperty('changes')
    })
  })
})
