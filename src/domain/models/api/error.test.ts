/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  fieldErrorSchema,
  validationErrorResponseSchema,
  errorResponseSchema,
  betterAuthErrorSchema,
  apiErrorSchema,
} from './error'

describe('fieldErrorSchema', () => {
  test('validates field error with all properties', () => {
    const input = { field: 'email', message: 'Invalid email', code: 'INVALID_FORMAT' }
    const result = fieldErrorSchema.parse(input)
    expect(result).toEqual(input)
  })

  test('validates field error without optional code', () => {
    const input = { field: 'name', message: 'Name is required' }
    const result = fieldErrorSchema.parse(input)
    expect(result.field).toBe('name')
    expect(result.code).toBeUndefined()
  })

  test('rejects missing field name', () => {
    expect(() => fieldErrorSchema.parse({ message: 'Error' })).toThrow()
  })
})

describe('validationErrorResponseSchema', () => {
  test('validates complete validation error', () => {
    const input = {
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'email', message: 'Invalid email' }],
    }
    const result = validationErrorResponseSchema.parse(input)
    expect(result.success).toBe(false)
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.errors).toHaveLength(1)
  })

  test('validates with empty errors array', () => {
    const input = {
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [],
    }
    const result = validationErrorResponseSchema.parse(input)
    expect(result.errors).toEqual([])
  })

  test('rejects success: true', () => {
    expect(() =>
      validationErrorResponseSchema.parse({
        success: true,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: [],
      })
    ).toThrow()
  })

  test('rejects non-VALIDATION_ERROR code', () => {
    expect(() =>
      validationErrorResponseSchema.parse({
        success: false,
        message: 'Error',
        code: 'NOT_FOUND',
        errors: [],
      })
    ).toThrow()
  })
})

describe('errorResponseSchema', () => {
  test('validates error with all codes', () => {
    const codes = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'CONFLICT',
      'RATE_LIMITED',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
    ] as const

    for (const code of codes) {
      const result = errorResponseSchema.parse({
        success: false,
        message: `Error: ${code}`,
        code,
      })
      expect(result.code).toBe(code)
    }
  })

  test('validates with optional details', () => {
    const input = {
      success: false,
      message: 'Not found',
      code: 'NOT_FOUND',
      details: ['Resource does not exist'],
    }
    const result = errorResponseSchema.parse(input)
    expect(result.details).toEqual(['Resource does not exist'])
  })

  test('validates without optional fields', () => {
    const input = {
      success: false,
      message: 'Unauthorized',
      code: 'UNAUTHORIZED',
    }
    const result = errorResponseSchema.parse(input)
    expect(result.error).toBeUndefined()
    expect(result.details).toBeUndefined()
  })

  test('rejects invalid error code', () => {
    expect(() =>
      errorResponseSchema.parse({
        success: false,
        message: 'Error',
        code: 'INVALID_CODE',
      })
    ).toThrow()
  })
})

describe('betterAuthErrorSchema', () => {
  test('validates Better Auth error format', () => {
    const input = { error: { message: 'Invalid credentials' } }
    const result = betterAuthErrorSchema.parse(input)
    expect(result.error.message).toBe('Invalid credentials')
  })

  test('validates with optional status', () => {
    const input = { error: { message: 'Not found', status: 404 } }
    const result = betterAuthErrorSchema.parse(input)
    expect(result.error.status).toBe(404)
  })
})

describe('apiErrorSchema', () => {
  test('accepts validation error format', () => {
    const input = {
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [],
    }
    expect(() => apiErrorSchema.parse(input)).not.toThrow()
  })

  test('accepts generic error format', () => {
    const input = {
      success: false,
      message: 'Internal error',
      code: 'INTERNAL_ERROR',
    }
    expect(() => apiErrorSchema.parse(input)).not.toThrow()
  })

  test('accepts Better Auth error format', () => {
    const input = { error: { message: 'Auth error' } }
    expect(() => apiErrorSchema.parse(input)).not.toThrow()
  })

  test('rejects completely invalid input', () => {
    expect(() => apiErrorSchema.parse({ random: 'data' })).toThrow()
  })
})
