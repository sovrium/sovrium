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
        activeTeamId: null,
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const executedSql: string[] = []
      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              executedSql.push(sql)
              // Mock members table for org role lookup
              if (sql.includes('_sovrium_auth_members')) {
                return [{ role: 'member' }]
              }
              // Mock users table for fallback
              if (sql.includes('_sovrium_auth_users')) {
                return [{ role: 'authenticated' }]
              }
              return undefined
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
      // Verify session variables were set (last query)
      const setLocalQuery = executedSql.find((sql) => sql.includes('SET LOCAL'))
      expect(setLocalQuery).toContain("SET LOCAL app.user_id = 'user_123'")
      expect(setLocalQuery).toContain("SET LOCAL app.organization_id = 'org_456'")
      expect(setLocalQuery).toContain("SET LOCAL app.user_role = 'member'")
    })

    it('should handle user without organization', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
        activeOrganizationId: null,
        activeTeamId: null,
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const executedSql: string[] = []
      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              executedSql.push(sql)
              // Mock users table for global role lookup
              if (sql.includes('_sovrium_auth_users')) {
                return [{ role: null }]
              }
              return undefined
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
      // Verify empty string for organization when null
      const setLocalQuery = executedSql.find((sql) => sql.includes('SET LOCAL'))
      expect(setLocalQuery).toContain("SET LOCAL app.organization_id = ''")
      // Verify defaults to 'authenticated' when no role
      expect(setLocalQuery).toContain("SET LOCAL app.user_role = 'authenticated'")
    })

    it('should escape SQL injection attempts', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: "user'; DROP TABLE users; --",
        activeOrganizationId: "org'; DROP TABLE orgs; --",
        activeTeamId: null,
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const executedSql: string[] = []
      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              executedSql.push(sql)
              // Mock members table - no role found (triggers fallback)
              if (sql.includes('_sovrium_auth_members')) {
                return []
              }
              // Mock users table for fallback
              if (sql.includes('_sovrium_auth_users')) {
                return [{ role: 'authenticated' }]
              }
              return undefined
            }),
          }
          return await callback(mockTx)
        }),
      }

      const originalDb = (await import('./drizzle/db')).db
      Object.assign(originalDb, mockDb)

      const operation = (_tx: any) => Effect.succeed('result')

      await Effect.runPromise(withSessionContext(mockSession, operation))

      // Verify SQL injection is escaped in all queries
      const memberQuery = executedSql.find((sql) => sql.includes('_sovrium_auth_members'))
      const userQuery = executedSql.find((sql) => sql.includes('_sovrium_auth_users'))
      const setLocalQuery = executedSql.find((sql) => sql.includes('SET LOCAL'))

      // All queries should have escaped the injection attempt
      expect(memberQuery).toContain("org''; DROP TABLE orgs; --")
      expect(userQuery).toContain("user''; DROP TABLE users; --")
      expect(setLocalQuery).toContain("user''; DROP TABLE users; --")
      expect(setLocalQuery).toContain("org''; DROP TABLE orgs; --")
    })
  })

  describe('withSessionContextSimple', () => {
    it('should execute async operation with session context', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
        activeOrganizationId: 'org_456',
        activeTeamId: null,
        token: 'token_123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
        impersonatedBy: null,
      }

      const executedSql: string[] = []
      const mockDb = {
        transaction: mock(async (callback: any) => {
          const mockTx = {
            execute: mock(async (sql: string) => {
              executedSql.push(sql)
              // Mock members table for org role lookup
              if (sql.includes('_sovrium_auth_members')) {
                return [{ role: 'admin' }]
              }
              return undefined
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
      // Verify session variables were set
      const setLocalQuery = executedSql.find((sql) => sql.includes('SET LOCAL'))
      expect(setLocalQuery).toContain("SET LOCAL app.user_id = 'user_123'")
      expect(setLocalQuery).toContain("SET LOCAL app.organization_id = 'org_456'")
    })

    it('should propagate errors from operation', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
        activeOrganizationId: null,
        activeTeamId: null,
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
              // Mock users table for global role lookup
              if (sql.includes('_sovrium_auth_users')) {
                return [{ role: 'authenticated' }]
              }
              return undefined
            }),
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
