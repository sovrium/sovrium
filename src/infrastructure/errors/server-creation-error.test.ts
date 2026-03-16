/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { ServerCreationError } from './server-creation-error'

describe('ServerCreationError', () => {
  describe('Error construction', () => {
    test('creates error with string cause', () => {
      // Given
      const cause = 'Failed to bind to port 3000'

      // When
      const error = new ServerCreationError(cause)

      // Then
      expect(error).toBeInstanceOf(ServerCreationError)
      expect(error._tag).toBe('ServerCreationError')
      expect(error.cause).toBe(cause)
    })

    test('creates error with Error cause', () => {
      // Given
      const cause = new Error('Connection refused')

      // When
      const error = new ServerCreationError(cause)

      // Then
      expect(error).toBeInstanceOf(ServerCreationError)
      expect(error._tag).toBe('ServerCreationError')
      expect(error.cause).toBe(cause)
    })

    test('creates error with object cause', () => {
      // Given
      const cause = { code: 'EADDRINUSE', port: 3000 }

      // When
      const error = new ServerCreationError(cause)

      // Then
      expect(error).toBeInstanceOf(ServerCreationError)
      expect(error._tag).toBe('ServerCreationError')
      expect(error.cause).toEqual(cause)
    })

    test('creates error with null cause', () => {
      // Given
      const cause = null

      // When
      const error = new ServerCreationError(cause)

      // Then
      expect(error).toBeInstanceOf(ServerCreationError)
      expect(error._tag).toBe('ServerCreationError')
      expect(error.cause).toBe(null)
    })

    test('creates error with undefined cause', () => {
      // Given
      const cause = undefined

      // When
      const error = new ServerCreationError(cause)

      // Then
      expect(error).toBeInstanceOf(ServerCreationError)
      expect(error._tag).toBe('ServerCreationError')
      expect(error.cause).toBe(undefined)
    })
  })

  describe('Error tag', () => {
    test('has correct _tag property', () => {
      // When
      const error = new ServerCreationError('test')

      // Then
      expect(error._tag).toBe('ServerCreationError')
      // Note: TypeScript readonly is compile-time only, not runtime enforced
      // The _tag property should not be modified in practice
    })

    test('tag is consistent across instances', () => {
      // When
      const error1 = new ServerCreationError('cause1')
      const error2 = new ServerCreationError('cause2')

      // Then
      expect(error1._tag).toBe('ServerCreationError')
      expect(error2._tag).toBe('ServerCreationError')
      expect(error1._tag).toBe(error2._tag)
    })
  })

  describe('Error cause', () => {
    test('preserves complex error objects', () => {
      // Given
      const complexCause = {
        message: 'Server startup failed',
        code: 'SERVER_ERROR',
        details: {
          port: 3000,
          host: 'localhost',
          timestamp: new Date('2025-01-01'),
        },
      }

      // When
      const error = new ServerCreationError(complexCause)

      // Then
      expect(error.cause).toEqual(complexCause)
      expect((error.cause as any).details.port).toBe(3000)
    })

    test('preserves Error stack traces', () => {
      // Given
      const originalError = new Error('Original error')
      const stackTrace = originalError.stack

      // When
      const error = new ServerCreationError(originalError)

      // Then
      expect((error.cause as Error).stack).toBe(stackTrace)
      expect((error.cause as Error).message).toBe('Original error')
    })

    test('handles circular references in cause', () => {
      // Given
      const circularObj: any = { name: 'circular' }
      circularObj.self = circularObj

      // When
      const error = new ServerCreationError(circularObj)

      // Then
      expect(error.cause).toBe(circularObj)
      expect((error.cause as any).self).toBe(circularObj)
    })
  })

  describe('Type guards and instanceof', () => {
    test('works with instanceof checks', () => {
      // When
      const error = new ServerCreationError('test')
      const regularError = new Error('regular')

      // Then
      expect(error instanceof ServerCreationError).toBe(true)
      expect(regularError instanceof ServerCreationError).toBe(false)
    })

    test('can be used in Effect error handling', () => {
      // Given
      const error = new ServerCreationError('test')

      // When
      const isServerCreationError = (e: unknown): e is ServerCreationError =>
        e instanceof ServerCreationError && e._tag === 'ServerCreationError'

      // Then
      expect(isServerCreationError(error)).toBe(true)
      expect(isServerCreationError(new Error('test'))).toBe(false)
      expect(isServerCreationError({ _tag: 'ServerCreationError' })).toBe(false)
    })
  })

  describe('Usage patterns', () => {
    test('can be thrown and caught', () => {
      // Given
      const errorCause = 'Port already in use'

      // When/Then
      expect(() => {
        throw new ServerCreationError(errorCause)
      }).toThrow()
      try {
        throw new ServerCreationError(errorCause)
      } catch (e) {
        expect(e).toBeInstanceOf(ServerCreationError)
        expect((e as ServerCreationError)._tag).toBe('ServerCreationError')
        expect((e as ServerCreationError).cause).toBe(errorCause)
      }
    })

    test('can be created from caught exceptions', () => {
      // Given
      let capturedError: ServerCreationError | undefined

      // When
      try {
        throw new Error('Original error')
      } catch (e) {
        capturedError = new ServerCreationError(e)
      }

      // Then
      expect(capturedError).toBeDefined()
      expect(capturedError?._tag).toBe('ServerCreationError')
      expect((capturedError?.cause as Error).message).toBe('Original error')
    })

    test('can chain multiple error causes', () => {
      // Given
      const rootCause = new Error('Database connection failed')
      const intermediateError = new ServerCreationError(rootCause)
      const finalError = new ServerCreationError(intermediateError)

      // When
      const unwrapCause = (error: ServerCreationError): unknown => {
        let { cause } = error
        while (cause instanceof ServerCreationError) {
          cause = cause.cause
        }
        return cause
      }

      // Then
      expect(finalError.cause).toBe(intermediateError)
      expect((finalError.cause as ServerCreationError).cause).toBe(rootCause)
      expect(unwrapCause(finalError)).toBe(rootCause)
    })
  })
})
