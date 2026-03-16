/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { DataSourceSchema, DataFilterSchema, DataSortSchema, PaginationSchema } from './data-source'

describe('DataFilterSchema', () => {
  test('should accept valid filter', () => {
    const result = Schema.decodeUnknownSync(DataFilterSchema)({
      field: 'status',
      operator: 'eq',
      value: 'published',
    })
    expect(result.field).toBe('status')
    expect(result.operator).toBe('eq')
    expect(result.value).toBe('published')
  })

  test('should accept numeric filter value', () => {
    const result = Schema.decodeUnknownSync(DataFilterSchema)({
      field: 'views',
      operator: 'gte',
      value: 100,
    })
    expect(result.value).toBe(100)
  })

  test('should accept boolean filter value', () => {
    const result = Schema.decodeUnknownSync(DataFilterSchema)({
      field: 'published',
      operator: 'eq',
      value: true,
    })
    expect(result.value).toBe(true)
  })

  test('should accept all operators', () => {
    const operators = ['eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte'] as const
    for (const operator of operators) {
      const result = Schema.decodeUnknownSync(DataFilterSchema)({
        field: 'test',
        operator,
        value: 'x',
      })
      expect(result.operator).toBe(operator)
    }
  })

  test('should reject invalid operator', () => {
    expect(() =>
      Schema.decodeUnknownSync(DataFilterSchema)({
        field: 'test',
        operator: 'like',
        value: 'x',
      })
    ).toThrow()
  })
})

describe('DataSortSchema', () => {
  test('should accept ascending sort', () => {
    const result = Schema.decodeUnknownSync(DataSortSchema)({
      field: 'createdAt',
      direction: 'asc',
    })
    expect(result.field).toBe('createdAt')
    expect(result.direction).toBe('asc')
  })

  test('should accept descending sort', () => {
    const result = Schema.decodeUnknownSync(DataSortSchema)({
      field: 'name',
      direction: 'desc',
    })
    expect(result.direction).toBe('desc')
  })

  test('should reject invalid direction', () => {
    expect(() =>
      Schema.decodeUnknownSync(DataSortSchema)({
        field: 'name',
        direction: 'ascending',
      })
    ).toThrow()
  })
})

describe('PaginationSchema', () => {
  test('should accept valid pagination', () => {
    const result = Schema.decodeUnknownSync(PaginationSchema)({
      pageSize: 20,
      style: 'numbered',
    })
    expect(result.pageSize).toBe(20)
    expect(result.style).toBe('numbered')
  })

  test('should accept pageSize only', () => {
    const result = Schema.decodeUnknownSync(PaginationSchema)({
      pageSize: 10,
    })
    expect(result.pageSize).toBe(10)
    expect(result.style).toBeUndefined()
  })

  test('should accept all pagination styles', () => {
    for (const style of ['numbered', 'loadMore', 'infinite'] as const) {
      const result = Schema.decodeUnknownSync(PaginationSchema)({
        pageSize: 10,
        style,
      })
      expect(result.style).toBe(style)
    }
  })

  test('should reject zero pageSize', () => {
    expect(() =>
      Schema.decodeUnknownSync(PaginationSchema)({
        pageSize: 0,
      })
    ).toThrow()
  })

  test('should reject negative pageSize', () => {
    expect(() =>
      Schema.decodeUnknownSync(PaginationSchema)({
        pageSize: -5,
      })
    ).toThrow()
  })
})

describe('DataSourceSchema', () => {
  test('should accept minimal data source (table only)', () => {
    const result = Schema.decodeUnknownSync(DataSourceSchema)({
      table: 'posts',
    })
    expect(result.table).toBe('posts')
    expect(result.mode).toBeUndefined()
  })

  test('should accept list mode with full configuration', () => {
    const result = Schema.decodeUnknownSync(DataSourceSchema)({
      table: 'posts',
      fields: ['title', 'excerpt', 'author'],
      mode: 'list',
      filter: [{ field: 'status', operator: 'eq', value: 'published' }],
      sort: [{ field: 'createdAt', direction: 'desc' }],
      pagination: {
        pageSize: 10,
        style: 'numbered',
      },
    })
    expect(result.table).toBe('posts')
    expect(result.fields).toEqual(['title', 'excerpt', 'author'])
    expect(result.filter).toHaveLength(1)
    expect(result.sort).toHaveLength(1)
    expect(result.pagination?.pageSize).toBe(10)
  })

  test('should accept single mode with param', () => {
    const result = Schema.decodeUnknownSync(DataSourceSchema)({
      table: 'posts',
      mode: 'single',
      param: 'slug',
    })
    expect(result.mode).toBe('single')
    expect(result.param).toBe('slug')
  })

  test('should accept search mode with search fields', () => {
    const result = Schema.decodeUnknownSync(DataSourceSchema)({
      table: 'products',
      mode: 'search',
      searchFields: ['name', 'description'],
      debounceMs: 300,
      limit: 20,
    })
    expect(result.mode).toBe('search')
    expect(result.searchFields).toEqual(['name', 'description'])
    expect(result.debounceMs).toBe(300)
    expect(result.limit).toBe(20)
  })

  test('should accept data source with targetId', () => {
    const result = Schema.decodeUnknownSync(DataSourceSchema)({
      table: 'products',
      targetId: 'product-list',
    })
    expect(result.targetId).toBe('product-list')
  })

  test('should reject empty fields array', () => {
    expect(() =>
      Schema.decodeUnknownSync(DataSourceSchema)({
        table: 'posts',
        fields: [],
      })
    ).toThrow()
  })

  test('should reject invalid mode', () => {
    expect(() =>
      Schema.decodeUnknownSync(DataSourceSchema)({
        table: 'posts',
        mode: 'batch',
      })
    ).toThrow()
  })
})
