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
    it('should set session variables for user with organization', async () => {
      const executedSql: string[] = []
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async (sql: string) => {
          executedSql.push(sql)
          // Mock members table response
          if (sql.includes('SELECT role FROM members')) {
            return [{ role: 'admin' }]
          }
          return []
        }),
      }

      const session: Session = {
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

      const result = await Effect.runPromise(setDatabaseSessionContext(mockTx, session))

      expect(result).toBeUndefined()
      expect(executedSql.length).toBe(2)
      expect(executedSql[0]).toContain('SELECT role FROM members')
      expect(executedSql[1]).toContain("SET LOCAL app.user_id = 'user_123'")
      expect(executedSql[1]).toContain("SET LOCAL app.organization_id = 'org_456'")
      expect(executedSql[1]).toContain("SET LOCAL app.user_role = 'admin'")
    })

    it('should set session variables for user without organization', async () => {
      const executedSql: string[] = []
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async (sql: string) => {
          executedSql.push(sql)
          return []
        }),
      }

      const session: Session = {
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

      const result = await Effect.runPromise(setDatabaseSessionContext(mockTx, session))

      expect(result).toBeUndefined()
      expect(executedSql.length).toBe(1)
      expect(executedSql[0]).toContain("SET LOCAL app.user_id = 'user_123'")
      expect(executedSql[0]).toContain("SET LOCAL app.organization_id = ''")
      expect(executedSql[0]).toContain("SET LOCAL app.user_role = 'authenticated'")
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
        activeOrganizationId: null,
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
      // Single quotes should be doubled for SQL escape
      expect(executedSql[0]).toContain("SET LOCAL app.user_id = 'user''; DROP TABLE users; --'")
    })

    it('should handle missing member record gracefully', async () => {
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async (sql: string) => {
          if (sql.includes('SELECT role FROM members')) {
            return [] // No member found
          }
          return []
        }),
      }

      const session: Session = {
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

      const result = await Effect.runPromise(setDatabaseSessionContext(mockTx, session))

      expect(result).toBeUndefined()
      // Should default to 'authenticated' role when no member record found
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
        activeOrganizationId: null,
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
      expect(executedSql[0]).toContain('RESET app.organization_id')
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
              organization_id: 'org_456',
              role: 'admin',
            },
          ]
        }),
      }

      const result = await Effect.runPromise(getCurrentSessionContext(mockTx))

      expect(result).toEqual({
        userId: 'user_123',
        organizationId: 'org_456',
        role: 'admin',
      })
    })

    it('should return empty strings for unset variables', async () => {
      const mockTx: DatabaseTransaction = {
        unsafe: mock(async () => {
          return [
            {
              user_id: null,
              organization_id: null,
              role: null,
            },
          ]
        }),
      }

      const result = await Effect.runPromise(getCurrentSessionContext(mockTx))

      expect(result).toEqual({
        userId: '',
        organizationId: '',
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
