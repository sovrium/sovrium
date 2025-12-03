/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, it, expect, mock } from 'bun:test'
import { Effect } from 'effect'
import { withSessionContext, withSessionContextSimple } from './with-session-context'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

// Helper functions for withSessionContextSimple tests
const asyncOperation = async (_tx: unknown) => {
  return 'async result'
}

const failingOperation = async (_tx: unknown) => {
  throw new Error('Operation failed')
}

describe('with-session-context', () => {
  describe('withSessionContext', () => {
    it('should execute operation with session context set', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
        activeOrganizationId: 'org_456',
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              // Verify session variables are being set
              expect(sql).toContain("SET LOCAL app.user_id = 'user_123'")
              expect(sql).toContain("SET LOCAL app.organization_id = 'org_456'")
              expect(sql).toContain("SET LOCAL app.user_role = 'authenticated'")
            }),
          }
          return await callback(mockTx)
        }),
      }

      // Mock db import
      const originalDb = (await import('./drizzle/db')).db
      Object.assign(originalDb, mockDb)

      const operation = (_tx: any) => Effect.succeed('test result')

      const result = await Effect.runPromise(withSessionContext(mockSession, operation))

      expect(result).toBe('test result')
      expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    })

    it('should handle user without organization', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
        activeOrganizationId: null,
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              // Verify empty string for organization when null
              expect(sql).toContain("SET LOCAL app.organization_id = ''")
            }),
          }
          return await callback(mockTx)
        }),
      }

      const originalDb = (await import('./drizzle/db')).db
      Object.assign(originalDb, mockDb)

      const operation = (_tx: any) => Effect.succeed('result')

      await Effect.runPromise(withSessionContext(mockSession, operation))

      expect(mockDb.transaction).toHaveBeenCalled()
    })

    it('should escape SQL injection attempts', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: "user'; DROP TABLE users; --",
        activeOrganizationId: "org'; DROP TABLE orgs; --",
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              // Verify single quotes are doubled for SQL escape
              expect(sql).toContain("user''; DROP TABLE users; --")
              expect(sql).toContain("org''; DROP TABLE orgs; --")
            }),
          }
          return await callback(mockTx)
        }),
      }

      const originalDb = (await import('./drizzle/db')).db
      Object.assign(originalDb, mockDb)

      const operation = (_tx: any) => Effect.succeed('result')

      await Effect.runPromise(withSessionContext(mockSession, operation))
    })
  })

  describe('withSessionContextSimple', () => {
    it('should execute async operation with session context', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
        activeOrganizationId: 'org_456',
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              expect(sql).toContain("SET LOCAL app.user_id = 'user_123'")
              expect(sql).toContain("SET LOCAL app.organization_id = 'org_456'")
            }),
          }
          return await callback(mockTx)
        }),
      }

      const originalDb = (await import('./drizzle/db')).db
      Object.assign(originalDb, mockDb)

      const result = await withSessionContextSimple(mockSession, asyncOperation)

      expect(result).toBe('async result')
      expect(mockDb.transaction).toHaveBeenCalled()
    })

    it('should propagate errors from operation', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
        activeOrganizationId: null,
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async () => {}),
          }
          return await callback(mockTx)
        }),
      }

      const originalDb = (await import('./drizzle/db')).db
      Object.assign(originalDb, mockDb)

      await expect(withSessionContextSimple(mockSession, failingOperation)).rejects.toThrow(
        'Operation failed'
      )
    })
  })
})
