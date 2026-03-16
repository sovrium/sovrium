/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { StaticGenerationError } from './static-generation-error'

describe('StaticGenerationError', () => {
  test('should create error with message', () => {
    const error = new StaticGenerationError({ message: 'Failed to generate' })
    expect(error.message).toBe('Failed to generate')
    expect(error._tag).toBe('StaticGenerationError')
  })

  test('should create error with message and cause', () => {
    const cause = new Error('Underlying error')
    const error = new StaticGenerationError({
      message: 'Failed to generate static site',
      cause,
    })
    expect(error.message).toBe('Failed to generate static site')
    expect(error.cause).toBe(cause)
    expect(error._tag).toBe('StaticGenerationError')
  })

  test('should create error without cause', () => {
    const error = new StaticGenerationError({ message: 'Generation failed' })
    expect(error.cause).toBeUndefined()
  })

  test('should be instanceof StaticGenerationError', () => {
    const error = new StaticGenerationError({ message: 'Test' })
    expect(error).toBeInstanceOf(StaticGenerationError)
  })

  test('should have correct _tag for Effect error handling', () => {
    const error = new StaticGenerationError({ message: 'Test' })
    expect(error._tag).toBe('StaticGenerationError')
  })
})
