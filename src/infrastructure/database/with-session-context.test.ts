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
            execute: mock(async (sql: any) => {
              // Extract SQL string from drizzle sql.raw() object
              // Structure: { queryChunks: [{ value: ["SQL STRING"] }] }
              const sqlStr: string = sql?.queryChunks?.[0]?.value?.[0] ?? String(sql)
              executedSql.push(sqlStr)
              // Mock users table for role lookup
              if (sqlStr.includes('"auth"."user"')) {
                return [{ role: 'member' }]
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
      // Verify session variables were set (separate SET LOCAL statements)
      const setLocalQueries = executedSql.filter((s) => s.includes('SET LOCAL'))
      expect(setLocalQueries.some((s) => s.includes('SET LOCAL ROLE app_user'))).toBe(true)
      expect(setLocalQueries.some((s) => s.includes("app.user_id = 'user_123'"))).toBe(true)
      expect(setLocalQueries.some((s) => s.includes("app.user_role = 'member'"))).toBe(true)
    })

    it('should handle user without organization', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
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
            execute: mock(async (sql: any) => {
              // Extract SQL string from drizzle sql.raw() object
              const sqlStr: string = sql?.queryChunks?.[0]?.value?.[0] ?? String(sql)
              executedSql.push(sqlStr)
              // Mock users table for global role lookup
              if (sqlStr.includes('"auth"."user"')) {
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
      // Verify session variables were set (separate SET LOCAL statements)
      const setLocalQueries = executedSql.filter((s) => s.includes('SET LOCAL'))
      // Verify defaults to 'authenticated' when no role
      expect(setLocalQueries.some((s) => s.includes("app.user_role = 'authenticated'"))).toBe(true)
    })

    it('should escape SQL injection attempts', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: "user'; DROP TABLE users; --",
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
            execute: mock(async (sql: any) => {
              // Extract SQL string from drizzle sql.raw() object
              const sqlStr: string = sql?.queryChunks?.[0]?.value?.[0] ?? String(sql)
              executedSql.push(sqlStr)
              // Mock users table for role lookup
              if (sqlStr.includes('"auth"."user"')) {
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
      const userQuery = executedSql.find((s) => s.includes('"auth"."user"'))
      const setLocalQueries = executedSql.filter((s) => s.includes('SET LOCAL'))

      // All queries should have escaped the injection attempt
      expect(userQuery).toContain("user''; DROP TABLE users; --")
      // Check for escaped values in SET LOCAL statements
      expect(setLocalQueries.some((s) => s.includes("user''; DROP TABLE users; --"))).toBe(true)
    })
  })

  describe('withSessionContextSimple', () => {
    it('should execute async operation with session context', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
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
            execute: mock(async (sql: any) => {
              // Extract SQL string from drizzle sql.raw() object
              const sqlStr: string = sql?.queryChunks?.[0]?.value?.[0] ?? String(sql)
              executedSql.push(sqlStr)
              // Mock users table for role lookup
              if (sqlStr.includes('"auth"."user"')) {
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
      // Verify session variables were set (separate SET LOCAL statements)
      const setLocalQueries = executedSql.filter((s) => s.includes('SET LOCAL'))
      expect(setLocalQueries.some((s) => s.includes("app.user_id = 'user_123'"))).toBe(true)
    })

    it('should propagate errors from operation', async () => {
      const mockSession: Session = {
        id: 'session_123',
        userId: 'user_123',
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
            execute: mock(async (sql: any) => {
              // Extract SQL string from drizzle sql.raw() object
              const sqlStr: string = sql?.queryChunks?.[0]?.value?.[0] ?? String(sql)
              // Mock users table for global role lookup
              if (sqlStr.includes('"auth"."user"')) {
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
