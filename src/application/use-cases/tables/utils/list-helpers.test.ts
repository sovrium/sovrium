/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { applyFieldSelection, applyPagination } from './list-helpers'
import type { TransformedRecord } from './record-transformer'

describe('applyFieldSelection', () => {
  test('returns only selected fields from records', () => {
    const records: readonly TransformedRecord[] = [
      {
        id: '1',
        fields: { name: 'Alice', email: 'alice@example.com', age: 30 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: '2',
        fields: { name: 'Bob', email: 'bob@example.com', age: 25 },
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      },
    ]

    const result = applyFieldSelection(records, 'name,email')

    expect(result).toHaveLength(2)
    expect(result[0]?.fields).toEqual({ name: 'Alice', email: 'alice@example.com' })
    expect(result[1]?.fields).toEqual({ name: 'Bob', email: 'bob@example.com' })
    // System fields should still be present at root level
    expect(result[0]?.id).toBe('1')
    expect(result[0]?.createdAt).toBe('2025-01-01T00:00:00Z')
  })

  test('skips system fields in field selection', () => {
    const records: readonly TransformedRecord[] = [
      {
        id: '1',
        fields: { name: 'Alice', age: 30 },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    // Requesting id, createdAt, updatedAt should not duplicate them in fields
    const result = applyFieldSelection(records, 'id,name,createdAt,updatedAt')

    expect(result[0]?.fields).toEqual({ name: 'Alice' })
    expect(result[0]?.id).toBe('1')
    expect(result[0]?.createdAt).toBe('2025-01-01T00:00:00Z')
  })

  test('handles missing fields gracefully', () => {
    const records: readonly TransformedRecord[] = [
      {
        id: '1',
        fields: { name: 'Alice' },
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ]

    const result = applyFieldSelection(records, 'name,nonExistentField')

    expect(result[0]?.fields).toEqual({ name: 'Alice' })
  })
})

describe('applyPagination', () => {
  test('paginates records with default limit and offset', () => {
    const records = Array.from({ length: 150 }, (_, i) => ({
      id: String(i + 1),
      fields: { name: `User ${i + 1}` },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    })) as readonly TransformedRecord[]

    const result = applyPagination(records, 150)

    expect(result.paginatedRecords).toHaveLength(10) // Default limit
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(10)
    expect(result.pagination.offset).toBe(0)
    expect(result.pagination.total).toBe(150)
    expect(result.pagination.totalPages).toBe(15)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPreviousPage).toBe(false)
  })

  test('paginates with custom limit and offset', () => {
    const records = Array.from({ length: 50 }, (_, i) => ({
      id: String(i + 1),
      fields: { name: `User ${i + 1}` },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    })) as readonly TransformedRecord[]

    const result = applyPagination(records, 50, 10, 20)

    expect(result.paginatedRecords).toHaveLength(10)
    expect(result.pagination.page).toBe(3) // offset 20 / limit 10 = page 3
    expect(result.pagination.limit).toBe(10)
    expect(result.pagination.offset).toBe(20)
    expect(result.pagination.hasNextPage).toBe(true)
    expect(result.pagination.hasPreviousPage).toBe(true)
  })

  test('handles last page correctly', () => {
    const records = Array.from({ length: 25 }, (_, i) => ({
      id: String(i + 1),
      fields: { name: `User ${i + 1}` },
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    })) as readonly TransformedRecord[]

    const result = applyPagination(records, 25, 10, 20)

    expect(result.paginatedRecords).toHaveLength(5) // Only 5 records left
    expect(result.pagination.hasNextPage).toBe(false)
    expect(result.pagination.hasPreviousPage).toBe(true)
  })
})

// Note: processRecords is tested indirectly through integration tests
// as it requires complex mocking of field filtering and transformation
