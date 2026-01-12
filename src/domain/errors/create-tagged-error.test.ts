/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { createTaggedError } from './create-tagged-error'

describe('createTaggedError', () => {
  test('creates error class with correct _tag property', () => {
    const TestError = createTaggedError('TestError')
    const error = new TestError('some cause')

    expect(error._tag).toBe('TestError')
  })

  test('stores cause in readonly property', () => {
    const TestError = createTaggedError('TestError')
    const originalError = new Error('original error')
    const error = new TestError(originalError)

    expect(error.cause).toBe(originalError)
  })

  test('works with string causes', () => {
    const TestError = createTaggedError('TestError')
    const error = new TestError('string cause')

    expect(error.cause).toBe('string cause')
  })

  test('works with object causes', () => {
    const TestError = createTaggedError('TestError')
    const cause = { code: 500, message: 'Internal error' }
    const error = new TestError(cause)

    expect(error.cause).toEqual(cause)
  })

  test('works with null and undefined causes', () => {
    const TestError = createTaggedError('TestError')

    const errorWithNull = new TestError(null)
    expect(errorWithNull.cause).toBeNull()

    const errorWithUndefined = new TestError(undefined)
    expect(errorWithUndefined.cause).toBeUndefined()
  })

  test('creates distinct error classes for different tags', () => {
    const ErrorA = createTaggedError('ErrorA')
    const ErrorB = createTaggedError('ErrorB')

    const a = new ErrorA('cause')
    const b = new ErrorB('cause')

    expect(a._tag).toBe('ErrorA')
    expect(b._tag).toBe('ErrorB')
    expect(a._tag).not.toBe(b._tag)
  })

  test('error instances can be used in discriminated unions', () => {
    const ValidationError = createTaggedError('ValidationError')
    const NetworkError = createTaggedError('NetworkError')

    type AppError = InstanceType<typeof ValidationError> | InstanceType<typeof NetworkError>

    function handleError(error: AppError): string {
      switch (error._tag) {
        case 'ValidationError':
          return 'validation failed'
        case 'NetworkError':
          return 'network failed'
      }
    }

    expect(handleError(new ValidationError('invalid input'))).toBe('validation failed')
    expect(handleError(new NetworkError('timeout'))).toBe('network failed')
  })
})
