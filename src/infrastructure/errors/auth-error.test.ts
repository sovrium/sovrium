/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { AuthError } from './auth-error'

describe('AuthError', () => {
  describe('Error construction', () => {
    test('creates error with string cause', () => {
      // Given
      const cause = 'Invalid credentials'

      // When
      const error = new AuthError(cause)

      // Then
      expect(error).toBeInstanceOf(AuthError)
      expect(error._tag).toBe('AuthError')
      expect(error.cause).toBe(cause)
    })

    test('creates error with Error cause', () => {
      // Given
      const cause = new Error('Token expired')

      // When
      const error = new AuthError(cause)

      // Then
      expect(error).toBeInstanceOf(AuthError)
      expect(error._tag).toBe('AuthError')
      expect(error.cause).toBe(cause)
    })

    test('creates error with object cause', () => {
      // Given
      const cause = {
        code: 'AUTH_FAILED',
        reason: 'Invalid token',
        userId: 'user123',
      }

      // When
      const error = new AuthError(cause)

      // Then
      expect(error).toBeInstanceOf(AuthError)
      expect(error._tag).toBe('AuthError')
      expect(error.cause).toEqual(cause)
    })

    test('creates error with null cause', () => {
      // Given
      const cause = null

      // When
      const error = new AuthError(cause)

      // Then
      expect(error).toBeInstanceOf(AuthError)
      expect(error._tag).toBe('AuthError')
      expect(error.cause).toBe(null)
    })

    test('creates error with undefined cause', () => {
      // Given
      const cause = undefined

      // When
      const error = new AuthError(cause)

      // Then
      expect(error).toBeInstanceOf(AuthError)
      expect(error._tag).toBe('AuthError')
      expect(error.cause).toBe(undefined)
    })
  })

  describe('Error tag', () => {
    test('has correct _tag property', () => {
      // When
      const error = new AuthError('test')

      // Then
      expect(error._tag).toBe('AuthError')
      // Note: TypeScript readonly is compile-time only, not runtime enforced
      // The _tag property should not be modified in practice
    })

    test('tag is consistent across instances', () => {
      // When
      const error1 = new AuthError('cause1')
      const error2 = new AuthError('cause2')

      // Then
      expect(error1._tag).toBe('AuthError')
      expect(error2._tag).toBe('AuthError')
      expect(error1._tag).toBe(error2._tag)
    })

    test('tag differs from other error types', () => {
      // When
      const authError = new AuthError('auth failed')
      const regularError = new Error('regular error')

      // Then
      expect(authError._tag).toBe('AuthError')
      expect((regularError as any)._tag).toBeUndefined()
    })
  })

  describe('Authentication-specific scenarios', () => {
    test('handles invalid credentials error', () => {
      // Given
      const cause = {
        type: 'INVALID_CREDENTIALS',
        email: 'user@example.com',
        timestamp: new Date('2025-01-15T10:00:00Z'),
      }

      // When
      const error = new AuthError(cause)

      // Then
      expect(error.cause).toEqual(cause)
      expect((error.cause as any).type).toBe('INVALID_CREDENTIALS')
      expect((error.cause as any).email).toBe('user@example.com')
    })

    test('handles token expiration error', () => {
      // Given
      const cause = {
        type: 'TOKEN_EXPIRED',
        token: 'abc123...',
        expiresAt: '2025-01-01T00:00:00Z',
        currentTime: '2025-01-01T01:00:00Z',
      }

      // When
      const error = new AuthError(cause)

      // Then
      expect((error.cause as any).type).toBe('TOKEN_EXPIRED')
      expect((error.cause as any).expiresAt).toBe('2025-01-01T00:00:00Z')
    })

    test('handles permission denied error', () => {
      // Given
      const cause = {
        type: 'PERMISSION_DENIED',
        resource: '/api/admin',
        requiredRole: 'admin',
        userRole: 'user',
      }

      // When
      const error = new AuthError(cause)

      // Then
      expect((error.cause as any).type).toBe('PERMISSION_DENIED')
      expect((error.cause as any).resource).toBe('/api/admin')
      expect((error.cause as any).requiredRole).toBe('admin')
    })

    test('handles session timeout error', () => {
      // Given
      const cause = {
        type: 'SESSION_TIMEOUT',
        sessionId: 'session123',
        lastActivity: new Date('2025-01-01T10:00:00Z'),
        timeout: 3_600_000, // 1 hour in milliseconds
      }

      // When
      const error = new AuthError(cause)

      // Then
      expect((error.cause as any).type).toBe('SESSION_TIMEOUT')
      expect((error.cause as any).sessionId).toBe('session123')
      expect((error.cause as any).timeout).toBe(3_600_000)
    })
  })

  describe('Error cause preservation', () => {
    test('preserves complex auth error objects', () => {
      // Given
      const complexCause = {
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        details: {
          attempts: 3,
          maxAttempts: 5,
          lockoutTime: 300,
          ipAddress: '192.168.1.1',
        },
        stack: new Error().stack,
      }

      // When
      const error = new AuthError(complexCause)

      // Then
      expect(error.cause).toEqual(complexCause)
      expect((error.cause as any).details.attempts).toBe(3)
      expect((error.cause as any).details.ipAddress).toBe('192.168.1.1')
    })

    test('preserves Error stack traces', () => {
      // Given
      const originalError = new Error('Authentication failed')
      const stackTrace = originalError.stack

      // When
      const error = new AuthError(originalError)

      // Then
      expect((error.cause as Error).stack).toBe(stackTrace)
      expect((error.cause as Error).message).toBe('Authentication failed')
    })
  })

  describe('Type guards and instanceof', () => {
    test('works with instanceof checks', () => {
      // When
      const error = new AuthError('test')
      const regularError = new Error('regular')

      // Then
      expect(error instanceof AuthError).toBe(true)
      expect(regularError instanceof AuthError).toBe(false)
    })

    test('can be used in Effect error handling', () => {
      // Given
      const error = new AuthError('test')

      // When
      const isAuthError = (e: unknown): e is AuthError =>
        e instanceof AuthError && e._tag === 'AuthError'

      // Then
      expect(isAuthError(error)).toBe(true)
      expect(isAuthError(new Error('test'))).toBe(false)
      expect(isAuthError({ _tag: 'AuthError' })).toBe(false)
    })
  })

  describe('Usage patterns', () => {
    test('can be thrown and caught', () => {
      // Given
      const errorCause = 'Unauthorized access'

      // When/Then
      expect(() => {
        throw new AuthError(errorCause)
      }).toThrow()
      try {
        throw new AuthError(errorCause)
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError)
        expect((e as AuthError)._tag).toBe('AuthError')
        expect((e as AuthError).cause).toBe(errorCause)
      }
    })

    test('can be created from caught exceptions', () => {
      // Given
      let capturedError: AuthError | undefined

      // When
      try {
        // Simulate auth failure
        throw new Error('Invalid token')
      } catch (e) {
        capturedError = new AuthError(e)
      }

      // Then
      expect(capturedError).toBeDefined()
      expect(capturedError?._tag).toBe('AuthError')
      expect((capturedError?.cause as Error).message).toBe('Invalid token')
    })

    test('can chain multiple auth errors', () => {
      // Given
      const rootCause = new Error('Database connection failed')
      const dbAuthError = new AuthError(rootCause)
      const apiAuthError = new AuthError(dbAuthError)

      // When
      const unwrapCause = (error: AuthError): unknown => {
        let { cause } = error
        while (cause instanceof AuthError) {
          cause = cause.cause
        }
        return cause
      }

      // Then
      expect(apiAuthError.cause).toBe(dbAuthError)
      expect((apiAuthError.cause as AuthError).cause).toBe(rootCause)
      expect(unwrapCause(apiAuthError)).toBe(rootCause)
    })

    test('can be used in authentication middleware', () => {
      // When/Then - valid token
      expect(() => {
        const token: string = 'valid-token'
        if (!token || token === 'invalid') {
          throw new AuthError({
            type: 'INVALID_TOKEN',
            token,
            message: 'Token validation failed',
          })
        }
      }).not.toThrow()

      // When/Then - invalid token
      try {
        const token = 'invalid'
        if (!token || token === 'invalid') {
          throw new AuthError({
            type: 'INVALID_TOKEN',
            token,
            message: 'Token validation failed',
          })
        }
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError)
        expect((e as AuthError).cause).toEqual({
          type: 'INVALID_TOKEN',
          token: 'invalid',
          message: 'Token validation failed',
        })
      }
    })
  })
})
