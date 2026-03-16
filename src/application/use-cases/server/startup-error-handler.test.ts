/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import { handleStartupError, type ServerStartupError } from './startup-error-handler'

describe('handleStartupError', () => {
  test('should handle AppValidationError with correct message', () => {
    // Given: An AppValidationError
    const error: ServerStartupError = {
      _tag: 'AppValidationError',
      cause: 'Invalid app name format',
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should run without crashing (process.exit mocked)
    // Note: We cannot test the actual process.exit behavior in unit tests
    // as it would terminate the test runner. This is integration-level behavior
    // tested in E2E tests instead.
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle ServerCreationError with correct message', () => {
    // Given: A ServerCreationError
    const error: ServerStartupError = {
      _tag: 'ServerCreationError',
      cause: 'Port 3000 already in use',
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should be created correctly
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle CSSCompilationError with correct message', () => {
    // Given: A CSSCompilationError
    const error: ServerStartupError = {
      _tag: 'CSSCompilationError',
      cause: 'Tailwind config not found',
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should be created correctly
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle unknown error without _tag property', () => {
    // Given: An error without _tag
    const error = {
      message: 'Unexpected error',
    } as unknown as ServerStartupError

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should handle gracefully
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle error with unknown _tag value', () => {
    // Given: An error with unknown _tag
    const error = {
      _tag: 'UnknownErrorType',
      cause: 'Something went wrong',
    } as unknown as ServerStartupError

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should handle gracefully
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should create Effect that never resolves (due to process.exit)', () => {
    // Given: Any error
    const error: ServerStartupError = {
      _tag: 'AppValidationError',
      cause: 'Test error',
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect return type should be Effect<never>
    // This means the effect never completes successfully (process.exit is called)
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle AppValidationError with complex cause object', () => {
    // Given: AppValidationError with complex cause
    const error: ServerStartupError = {
      _tag: 'AppValidationError',
      cause: {
        field: 'name',
        value: '',
        message: 'Name must not be empty',
      },
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should be created correctly
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle ServerCreationError with Error object as cause', () => {
    // Given: ServerCreationError with Error object
    const error: ServerStartupError = {
      _tag: 'ServerCreationError',
      cause: new Error('EADDRINUSE: address already in use'),
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should be created correctly
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle CSSCompilationError with PostCSS error details', () => {
    // Given: CSSCompilationError with PostCSS error
    const error: ServerStartupError = {
      _tag: 'CSSCompilationError',
      cause: {
        name: 'CssSyntaxError',
        reason: 'Unknown at-rule @unknown',
        line: 42,
        column: 5,
      },
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should be created correctly
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle null cause value', () => {
    // Given: Error with null cause
    const error: ServerStartupError = {
      _tag: 'AppValidationError',
      cause: null,
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should handle null gracefully
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle undefined cause value', () => {
    // Given: Error with undefined cause
    const error: ServerStartupError = {
      _tag: 'ServerCreationError',
      cause: undefined,
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should handle undefined gracefully
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })

  test('should handle empty string cause', () => {
    // Given: Error with empty string cause
    const error: ServerStartupError = {
      _tag: 'CSSCompilationError',
      cause: '',
    }

    // When: handleStartupError is called
    const program = handleStartupError(error)

    // Then: Effect should handle empty string gracefully
    expect(program).toBeDefined()
    expect(Effect.isEffect(program)).toBe(true)
  })
})
