/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { SchemaInitializationError } from './schema-initialization-error'

describe('SchemaInitializationError', () => {
  describe('Error construction', () => {
    test('creates error with message only', () => {
      // Given
      const message = 'Schema initialization failed'

      // When
      const error = new SchemaInitializationError({ message })

      // Then
      expect(error).toBeInstanceOf(SchemaInitializationError)
      expect(error._tag).toBe('SchemaInitializationError')
      expect(error.message).toBe(message)
      expect(error.cause).toBeUndefined()
    })

    test('creates error with message and cause', () => {
      // Given
      const message = 'Failed to create table'
      const cause = new Error('Connection refused')

      // When
      const error = new SchemaInitializationError({ message, cause })

      // Then
      expect(error).toBeInstanceOf(SchemaInitializationError)
      expect(error._tag).toBe('SchemaInitializationError')
      expect(error.message).toBe(message)
      expect(error.cause).toBe(cause)
    })

    test('creates error with message and object cause', () => {
      // Given
      const message = 'Schema migration failed'
      const cause = {
        code: 'DB_ERROR',
        details: 'Invalid column type',
        table: 'users',
      }

      // When
      const error = new SchemaInitializationError({ message, cause })

      // Then
      expect(error).toBeInstanceOf(SchemaInitializationError)
      expect(error._tag).toBe('SchemaInitializationError')
      expect(error.message).toBe(message)
      expect(error.cause).toEqual(cause)
    })
  })

  describe('Error tag', () => {
    test('has correct _tag property', () => {
      // When
      const error = new SchemaInitializationError({ message: 'test' })

      // Then
      expect(error._tag).toBe('SchemaInitializationError')
    })

    test('tag is consistent across instances', () => {
      // When
      const error1 = new SchemaInitializationError({ message: 'Message 1' })
      const error2 = new SchemaInitializationError({ message: 'Message 2' })

      // Then
      expect(error1._tag).toBe('SchemaInitializationError')
      expect(error2._tag).toBe('SchemaInitializationError')
      expect(error1._tag).toBe(error2._tag)
    })
  })

  describe('Database error scenarios', () => {
    test('handles table creation failure', () => {
      // Given
      const message = 'Failed to create table: posts'
      const cause = new Error('Syntax error near "CREATEE TABLE"')

      // When
      const error = new SchemaInitializationError({ message, cause })

      // Then
      expect(error.message).toContain('Failed to create table')
      expect(error.message).toContain('posts')
      expect((error.cause as Error).message).toContain('Syntax error')
    })

    test('handles column type mismatch', () => {
      // Given
      const message = 'Schema initialization failed: Column type mismatch'
      const cause = {
        table: 'tasks',
        column: 'status',
        expected: 'VARCHAR(255)',
        actual: 'TEXT',
      }

      // When
      const error = new SchemaInitializationError({ message, cause })

      // Then
      expect(error.message).toContain('Column type mismatch')
      expect((error.cause as any).table).toBe('tasks')
      expect((error.cause as any).column).toBe('status')
    })

    test('handles foreign key constraint error', () => {
      // Given
      const message = 'Schema initialization failed: Foreign key constraint violation'
      const cause = {
        constraint: 'posts_user_id_fkey',
        table: 'posts',
        referencedTable: 'users',
        error: 'Referenced table does not exist',
      }

      // When
      const error = new SchemaInitializationError({ message, cause })

      // Then
      expect(error.message).toContain('Foreign key constraint')
      expect((error.cause as any).referencedTable).toBe('users')
    })

    test('handles transaction rollback', () => {
      // Given
      const message = 'Schema initialization failed: Transaction rolled back'
      const cause = new Error('Deadlock detected')

      // When
      const error = new SchemaInitializationError({ message, cause })

      // Then
      expect(error.message).toContain('Transaction rolled back')
      expect((error.cause as Error).message).toBe('Deadlock detected')
    })

    test('handles connection timeout', () => {
      // Given
      const message = 'Schema initialization failed: Connection timeout'
      const cause = {
        code: 'ETIMEDOUT',
        host: 'localhost',
        port: 5432,
        timeout: 5000,
      }

      // When
      const error = new SchemaInitializationError({ message, cause })

      // Then
      expect(error.message).toContain('Connection timeout')
      expect((error.cause as any).code).toBe('ETIMEDOUT')
      expect((error.cause as any).port).toBe(5432)
    })
  })

  describe('Type guards and instanceof', () => {
    test('works with instanceof checks', () => {
      // When
      const error = new SchemaInitializationError({ message: 'test' })
      const regularError = new Error('regular')

      // Then
      expect(error instanceof SchemaInitializationError).toBe(true)
      expect(regularError instanceof SchemaInitializationError).toBe(false)
    })

    test('can be used in Effect error handling', () => {
      // Given
      const error = new SchemaInitializationError({ message: 'test' })

      // When
      const isSchemaError = (e: unknown): e is SchemaInitializationError =>
        e instanceof SchemaInitializationError && e._tag === 'SchemaInitializationError'

      // Then
      expect(isSchemaError(error)).toBe(true)
      expect(isSchemaError(new Error('test'))).toBe(false)
      expect(isSchemaError({ _tag: 'SchemaInitializationError' })).toBe(false)
    })
  })

  describe('Usage patterns', () => {
    test('can be thrown and caught', () => {
      // Given
      const message = 'Schema initialization failed'

      // When/Then
      expect(() => {
        throw new SchemaInitializationError({ message })
      }).toThrow()

      try {
        throw new SchemaInitializationError({ message })
      } catch (e) {
        expect(e).toBeInstanceOf(SchemaInitializationError)
        expect((e as SchemaInitializationError)._tag).toBe('SchemaInitializationError')
        expect((e as SchemaInitializationError).message).toBe(message)
      }
    })

    test('can wrap database exceptions', () => {
      // Given
      let capturedError: SchemaInitializationError | undefined

      // When
      try {
        // Simulate database failure
        throw new Error('SQLSTATE 42P01: relation "users" does not exist')
      } catch (e) {
        capturedError = new SchemaInitializationError({
          message: 'Schema initialization failed: Table creation error',
          cause: e,
        })
      }

      // Then
      expect(capturedError).toBeDefined()
      expect(capturedError?._tag).toBe('SchemaInitializationError')
      expect((capturedError?.cause as Error).message).toContain('relation "users" does not exist')
    })

    test('can be used in schema migration workflow', async () => {
      // Given - simulate async schema initialization that fails
      const testWrapper = async () => {
        try {
          throw new Error('Connection refused')
        } catch (e) {
          throw new SchemaInitializationError({
            message: 'Schema initialization failed: Database connection error',
            cause: e,
          })
        }
      }

      // When/Then
      await expect(testWrapper()).rejects.toBeInstanceOf(SchemaInitializationError)
    })
  })

  describe('Cause preservation', () => {
    test('preserves Error stack traces', () => {
      // Given
      const originalError = new Error('SQL syntax error')
      const stackTrace = originalError.stack

      // When
      const error = new SchemaInitializationError({
        message: 'Schema initialization failed',
        cause: originalError,
      })

      // Then
      expect((error.cause as Error).stack).toBe(stackTrace)
      expect((error.cause as Error).message).toBe('SQL syntax error')
    })

    test('preserves complex error objects', () => {
      // Given
      const complexCause = {
        message: 'Migration failed',
        code: 'MIGRATION_ERROR',
        details: {
          step: 3,
          totalSteps: 5,
          failedSQL: 'CREATE TABLE posts (...)',
          timestamp: new Date('2025-01-15T10:00:00Z'),
        },
      }

      // When
      const error = new SchemaInitializationError({
        message: 'Schema initialization failed',
        cause: complexCause,
      })

      // Then
      expect(error.cause).toEqual(complexCause)
      expect((error.cause as any).details.step).toBe(3)
      expect((error.cause as any).details.failedSQL).toContain('CREATE TABLE')
    })
  })
})
