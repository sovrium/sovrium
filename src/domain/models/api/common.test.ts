/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  paginationSchema,
  paginationQuerySchema,
  timestampSchema,
  successResponseSchema,
} from './common'

describe('paginationSchema', () => {
  test('validates complete pagination object', () => {
    const input = {
      page: 1,
      limit: 20,
      offset: 0,
      total: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    }
    const result = paginationSchema.parse(input)
    expect(result).toEqual(input)
  })

  test('rejects non-integer page', () => {
    const input = {
      page: 1.5,
      limit: 20,
      offset: 0,
      total: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    }
    expect(() => paginationSchema.parse(input)).toThrow()
  })

  test('rejects page less than 1', () => {
    const input = {
      page: 0,
      limit: 20,
      offset: 0,
      total: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    }
    expect(() => paginationSchema.parse(input)).toThrow()
  })

  test('rejects negative offset', () => {
    const input = {
      page: 1,
      limit: 20,
      offset: -1,
      total: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    }
    expect(() => paginationSchema.parse(input)).toThrow()
  })

  test('rejects missing fields', () => {
    expect(() => paginationSchema.parse({ page: 1 })).toThrow()
  })
})

describe('paginationQuerySchema', () => {
  test('applies defaults when no values provided', () => {
    const result = paginationQuerySchema.parse({})
    expect(result).toEqual({ page: 1, limit: 20 })
  })

  test('coerces string values to numbers', () => {
    const result = paginationQuerySchema.parse({ page: '3', limit: '50' })
    expect(result).toEqual({ page: 3, limit: 50 })
  })

  test('rejects limit over 100', () => {
    expect(() => paginationQuerySchema.parse({ limit: 101 })).toThrow()
  })

  test('rejects page less than 1', () => {
    expect(() => paginationQuerySchema.parse({ page: 0 })).toThrow()
  })

  test('rejects limit less than 1', () => {
    expect(() => paginationQuerySchema.parse({ limit: 0 })).toThrow()
  })
})

describe('timestampSchema', () => {
  test('validates ISO 8601 timestamps', () => {
    const input = {
      createdAt: '2025-01-15T10:30:00Z',
      updatedAt: '2025-01-15T11:00:00Z',
    }
    const result = timestampSchema.parse(input)
    expect(result).toEqual(input)
  })

  test('rejects non-ISO strings', () => {
    expect(() =>
      timestampSchema.parse({
        createdAt: 'not-a-date',
        updatedAt: '2025-01-15T10:30:00Z',
      })
    ).toThrow()
  })

  test('rejects missing timestamps', () => {
    expect(() => timestampSchema.parse({ createdAt: '2025-01-15T10:30:00Z' })).toThrow()
  })
})

describe('successResponseSchema', () => {
  test('validates success response', () => {
    const result = successResponseSchema.parse({ success: true })
    expect(result).toEqual({ success: true })
  })

  test('rejects false value', () => {
    expect(() => successResponseSchema.parse({ success: false })).toThrow()
  })

  test('rejects missing success field', () => {
    expect(() => successResponseSchema.parse({})).toThrow()
  })
})
