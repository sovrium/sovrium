/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, it, expect, mock } from 'bun:test'
import { Effect, Either } from 'effect'
import {
  setDatabaseSessionContext,
  clearDatabaseSessionContext,
  getCurrentSessionContext,
  SessionContextError,
  type DatabaseTransaction,
} from './session-context'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

describe('session-context', () => {
  describe('setDatabaseSessionContext', () => {
    it('should set session variables for authenticated user', async () => {
      const executedSql: string[] = []
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async (sql: string) => {
          executedSql.push(sql)
          // Mock user table response for role lookup
          if (sql.includes('SELECT role FROM "auth.user"')) {
            return [{ role: 'admin' }]
          }
          return []
        }),
      }

      const session: Session = {
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

      const result = await Effect.runPromise(setDatabaseSessionContext(mockTx, session))

      expect(result).toBeUndefined()
      // 2 queries: 1 for user role lookup, 1 for SET LOCAL
      expect(executedSql.length).toBe(2)
      // First query: user table for role
      expect(executedSql[0]).toContain('SELECT role FROM "auth.user"')
      // Second query: SET LOCAL session variables
      expect(executedSql[1]).toContain("SET LOCAL app.user_id = 'user_123'")
      expect(executedSql[1]).toContain("SET LOCAL app.user_role = 'admin'")
    })

    it('should use default authenticated role when user role not found', async () => {
      const executedSql: string[] = []
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async (sql: string) => {
          executedSql.push(sql)
          // Return empty result for role query (user has no explicit role)
          return []
        }),
      }

      const session: Session = {
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

      const result = await Effect.runPromise(setDatabaseSessionContext(mockTx, session))

      expect(result).toBeUndefined()
      // 2 queries: 1 for user role lookup, 1 for SET LOCAL
      expect(executedSql.length).toBe(2)
      // First query: user role lookup
      expect(executedSql[0]).toContain('SELECT role FROM "auth.user"')
      // Second query: SET LOCAL session variables (no organization_id)
      expect(executedSql[1]).toContain("SET LOCAL app.user_id = 'user_123'")
      expect(executedSql[1]).toContain("SET LOCAL app.user_role = 'authenticated'")
    })

    it('should escape SQL injection attempts in user ID', async () => {
      const executedSql: string[] = []
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async (sql: string) => {
          executedSql.push(sql)
          return []
        }),
      }

      const session: Session = {
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

      const result = await Effect.runPromise(setDatabaseSessionContext(mockTx, session))

      expect(result).toBeUndefined()
      // Single quotes should be doubled for SQL escape in both queries
      // First query: user role lookup with escaped user ID
      expect(executedSql[0]).toContain("user''; DROP TABLE users; --")
      // Second query: SET LOCAL with escaped user ID
      expect(executedSql[1]).toContain("SET LOCAL app.user_id = 'user''; DROP TABLE users; --'")
    })

    it('should fail with SessionContextError on database error', async () => {
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async () => {
          throw new Error('Database connection failed')
        }),
      }

      const session: Session = {
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

      const result = await Effect.runPromise(
        Effect.either(setDatabaseSessionContext(mockTx, session))
      )

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(SessionContextError)
      }
    })
  })

  describe('clearDatabaseSessionContext', () => {
    it('should reset session variables', async () => {
      const executedSql: string[] = []
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async (sql: string) => {
          executedSql.push(sql)
          return undefined
        }),
      }

      await Effect.runPromise(clearDatabaseSessionContext(mockTx))

      expect(executedSql.length).toBe(1)
      expect(executedSql[0]).toContain('RESET app.user_id')
      expect(executedSql[0]).toContain('RESET app.user_role')
    })

    it('should fail with SessionContextError on database error', async () => {
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async () => {
          throw new Error('Database connection failed')
        }),
      }

      const result = await Effect.runPromise(Effect.either(clearDatabaseSessionContext(mockTx)))

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(SessionContextError)
      }
    })
  })

  describe('getCurrentSessionContext', () => {
    it('should retrieve current session context values', async () => {
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async () => {
          return [
            {
              user_id: 'user_123',
              role: 'admin',
            },
          ]
        }),
      }

      const result = await Effect.runPromise(getCurrentSessionContext(mockTx))

      expect(result).toEqual({
        userId: 'user_123',
        role: 'admin',
      })
    })

    it('should return empty strings for unset variables', async () => {
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async () => {
          return [
            {
              user_id: null,
              role: null,
            },
          ]
        }),
      }

      const result = await Effect.runPromise(getCurrentSessionContext(mockTx))

      expect(result).toEqual({
        userId: '',
        role: '',
      })
    })

    it('should fail with SessionContextError on database error', async () => {
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async () => {
          throw new Error('Database connection failed')
        }),
      }

      const result = await Effect.runPromise(Effect.either(getCurrentSessionContext(mockTx)))

      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(SessionContextError)
      }
    })
  })
})
