/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { AppValidationError } from './app-validation-error'

describe('AppValidationError', () => {
  describe('error construction', () => {
    test('creates error with string cause', () => {
      const error = new AppValidationError('Invalid app configuration')

      expect(error).toBeInstanceOf(AppValidationError)
      expect(error.cause).toBe('Invalid app configuration')
      expect(error._tag).toBe('AppValidationError')
    })

    test('creates error with Error cause', () => {
      const originalError = new Error('Validation failed')
      const error = new AppValidationError(originalError)

      expect(error).toBeInstanceOf(AppValidationError)
      expect(error.cause).toBe(originalError)
      expect(error._tag).toBe('AppValidationError')
    })

    test('creates error with object cause', () => {
      const cause = { field: 'name', message: 'Required field missing' }
      const error = new AppValidationError(cause)

      expect(error).toBeInstanceOf(AppValidationError)
      expect(error.cause).toEqual(cause)
      expect(error._tag).toBe('AppValidationError')
    })

    test('creates error with null cause', () => {
      const error = new AppValidationError(null)

      expect(error).toBeInstanceOf(AppValidationError)
      expect(error.cause).toBeNull()
      expect(error._tag).toBe('AppValidationError')
    })

    test('creates error with undefined cause', () => {
      const error = new AppValidationError(undefined)

      expect(error).toBeInstanceOf(AppValidationError)
      expect(error.cause).toBeUndefined()
      expect(error._tag).toBe('AppValidationError')
    })
  })

  describe('error properties', () => {
    test('_tag is readonly and always AppValidationError', () => {
      const error = new AppValidationError('test')

      expect(error._tag).toBe('AppValidationError')

      // Verify it's the correct discriminator for type narrowing
      const checkTag = (err: unknown): err is AppValidationError => {
        return (
          typeof err === 'object' &&
          err !== null &&
          '_tag' in err &&
          err._tag === 'AppValidationError'
        )
      }

      expect(checkTag(error)).toBe(true)
    })

    test('cause property preserves original error information', () => {
      const originalError = new Error('Original message')
      originalError.stack = 'Original stack trace'

      const error = new AppValidationError(originalError)

      expect(error.cause).toBe(originalError)
      expect((error.cause as Error).message).toBe('Original message')
      expect((error.cause as Error).stack).toBe('Original stack trace')
    })
  })

  describe('error usage in discriminated unions', () => {
    test('can be used in type-safe error handling', () => {
      type AppError = AppValidationError | { _tag: 'OtherError'; message: string }

      const handleError = (error: AppError): string => {
        switch (error._tag) {
          case 'AppValidationError':
            return `Validation failed: ${error.cause}`
          case 'OtherError':
            return `Other error: ${error.message}`
        }
      }

      const validationError = new AppValidationError('Invalid input')
      expect(handleError(validationError)).toBe('Validation failed: Invalid input')
    })

    test('_tag enables exhaustive type checking', () => {
      const error = new AppValidationError('test')

      if (error._tag === 'AppValidationError') {
        // TypeScript knows this is an AppValidationError
        expect(error.cause).toBeDefined()
      }
    })
  })

  describe('error serialization', () => {
    test('can be converted to plain object', () => {
      const error = new AppValidationError('test error')

      const plain = {
        _tag: error._tag,
        cause: error.cause,
      }

      expect(plain).toEqual({
        _tag: 'AppValidationError',
        cause: 'test error',
      })
    })

    test('preserves cause in JSON serialization', () => {
      const error = new AppValidationError({ field: 'name', value: 'invalid' })

      const json = JSON.stringify({
        _tag: error._tag,
        cause: error.cause,
      })

      const parsed = JSON.parse(json)

      expect(parsed._tag).toBe('AppValidationError')
      expect(parsed.cause).toEqual({ field: 'name', value: 'invalid' })
    })
  })
})
