/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Effect, Layer } from 'effect'
import { ActivityRepository } from '@/application/ports/repositories/activity-repository'
import { getRecordHistoryProgram } from './activity-programs'
import type { UserSession } from '@/application/ports/models/user-session'
import type { ActivityHistoryEntry } from '@/application/ports/repositories/activity-repository'

describe('activity-programs', () => {
  describe('getRecordHistoryProgram', () => {
    test('should fetch and format activity history', async () => {
      const mockHistory: readonly ActivityHistoryEntry[] = [
        {
          action: 'create',
          createdAt: new Date('2025-01-15T10:30:00Z'),
          changes: { name: 'New Record' },
          user: {
            id: 'user-1',
            name: 'Alice Johnson',
            email: 'alice@example.com',
            image: null,
          },
        },
      ]

      const mockSession: UserSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'test-token',
        expiresAt: new Date('2025-12-31T23:59:59Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        impersonatedBy: null,
      }

      const TestActivityRepositoryLive = Layer.succeed(ActivityRepository, {
        getRecordHistory: ({ session, tableName, recordId }) => {
          expect(session).toEqual(mockSession)
          expect(tableName).toBe('users')
          expect(recordId).toBe('record-1')
          return Effect.succeed(mockHistory)
        },
        checkRecordExists: () => Effect.succeed(true),
      })

      const program = getRecordHistoryProgram({
        session: mockSession,
        tableName: 'users',
        recordId: 'record-1',
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestActivityRepositoryLive))
      )

      expect(result.history).toHaveLength(1)
      expect(result.history[0]?.action).toBe('create')
      expect(result.history[0]?.createdAt).toBe('2025-01-15T10:30:00.000Z')
      expect(result.history[0]?.changes).toEqual({ name: 'New Record' })
      expect(result.history[0]?.user?.name).toBe('Alice Johnson')
    })

    test('should format multiple history entries', async () => {
      const mockHistory: readonly ActivityHistoryEntry[] = [
        {
          action: 'create',
          createdAt: new Date('2025-01-15T10:00:00Z'),
          changes: { name: 'Initial' },
          user: {
            id: 'user-1',
            name: 'User One',
            email: 'user1@example.com',
            image: 'avatar1.jpg',
          },
        },
        {
          action: 'update',
          createdAt: new Date('2025-01-15T11:00:00Z'),
          changes: { name: 'Updated' },
          user: {
            id: 'user-2',
            name: 'User Two',
            email: 'user2@example.com',
            image: null,
          },
        },
        {
          action: 'delete',
          createdAt: new Date('2025-01-15T12:00:00Z'),
          changes: {},
          user: undefined,
        },
      ]

      const mockSession: UserSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'test-token',
        expiresAt: new Date('2025-12-31T23:59:59Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        impersonatedBy: null,
      }

      const TestActivityRepositoryLive = Layer.succeed(ActivityRepository, {
        getRecordHistory: () => Effect.succeed(mockHistory),
        checkRecordExists: () => Effect.succeed(true),
      })

      const program = getRecordHistoryProgram({
        session: mockSession,
        tableName: 'posts',
        recordId: 'post-123',
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestActivityRepositoryLive))
      )

      expect(result.history).toHaveLength(3)
      expect(result.history[0]?.action).toBe('create')
      expect(result.history[0]?.createdAt).toBe('2025-01-15T10:00:00.000Z')
      expect(result.history[0]?.user?.image).toBe('avatar1.jpg')

      expect(result.history[1]?.action).toBe('update')
      expect(result.history[1]?.createdAt).toBe('2025-01-15T11:00:00.000Z')
      expect(result.history[1]?.user?.image).toBeNull()

      expect(result.history[2]?.action).toBe('delete')
      expect(result.history[2]?.createdAt).toBe('2025-01-15T12:00:00.000Z')
      expect(result.history[2]?.user).toBeUndefined()
    })

    test('should handle empty history', async () => {
      const mockHistory: readonly ActivityHistoryEntry[] = []

      const mockSession: UserSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'test-token',
        expiresAt: new Date('2025-12-31T23:59:59Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        impersonatedBy: null,
      }

      const TestActivityRepositoryLive = Layer.succeed(ActivityRepository, {
        getRecordHistory: () => Effect.succeed(mockHistory),
        checkRecordExists: () => Effect.succeed(true),
      })

      const program = getRecordHistoryProgram({
        session: mockSession,
        tableName: 'tables',
        recordId: 'table-1',
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestActivityRepositoryLive))
      )

      expect(result.history).toHaveLength(0)
      expect(result.history).toEqual([])
    })

    test('should preserve changes object structure', async () => {
      const complexChanges = {
        fields: {
          name: { old: 'Old Name', new: 'New Name' },
          email: { old: 'old@example.com', new: 'new@example.com' },
        },
        metadata: {
          updatedBy: 'user-1',
          reason: 'User request',
        },
      }

      const mockHistory: readonly ActivityHistoryEntry[] = [
        {
          action: 'update',
          createdAt: new Date('2025-01-15T14:00:00Z'),
          changes: complexChanges,
          user: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
            image: null,
          },
        },
      ]

      const mockSession: UserSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'test-token',
        expiresAt: new Date('2025-12-31T23:59:59Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'Test User Agent',
        impersonatedBy: null,
      }

      const TestActivityRepositoryLive = Layer.succeed(ActivityRepository, {
        getRecordHistory: () => Effect.succeed(mockHistory),
        checkRecordExists: () => Effect.succeed(true),
      })

      const program = getRecordHistoryProgram({
        session: mockSession,
        tableName: 'records',
        recordId: 'rec-1',
      })

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(TestActivityRepositoryLive))
      )

      expect(result.history[0]?.changes).toEqual(complexChanges)
    })
  })
})
