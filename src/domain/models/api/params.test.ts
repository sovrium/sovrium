/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  activityIdParamSchema,
  activityQuerySchema,
  commentBodySchema,
  commentIdParamSchema,
  listRecordsQuerySchema,
  recordIdParamSchema,
  tableIdParamSchema,
  viewIdParamSchema,
} from './params'

describe('Path Parameter Schemas', () => {
  test('tableIdParamSchema accepts valid table ID', () => {
    const result = tableIdParamSchema.safeParse({ tableId: 'tbl_123' })
    expect(result.success).toBe(true)
  })

  test('tableIdParamSchema rejects missing tableId', () => {
    const result = tableIdParamSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  test('recordIdParamSchema accepts valid table and record IDs', () => {
    const result = recordIdParamSchema.safeParse({ tableId: 'tbl_1', recordId: 'rec_1' })
    expect(result.success).toBe(true)
  })

  test('recordIdParamSchema rejects missing recordId', () => {
    const result = recordIdParamSchema.safeParse({ tableId: 'tbl_1' })
    expect(result.success).toBe(false)
  })

  test('commentIdParamSchema accepts all three IDs', () => {
    const result = commentIdParamSchema.safeParse({
      tableId: 'tbl_1',
      recordId: 'rec_1',
      commentId: 'cmt_1',
    })
    expect(result.success).toBe(true)
  })

  test('viewIdParamSchema accepts table and view IDs', () => {
    const result = viewIdParamSchema.safeParse({ tableId: 'tbl_1', viewId: 'view_1' })
    expect(result.success).toBe(true)
  })

  test('activityIdParamSchema accepts valid activity ID', () => {
    const result = activityIdParamSchema.safeParse({ activityId: 'act_1' })
    expect(result.success).toBe(true)
  })
})

describe('Query Parameter Schemas', () => {
  test('listRecordsQuerySchema accepts all optional params', () => {
    const result = listRecordsQuerySchema.safeParse({
      page: '1',
      limit: '10',
      sort: 'name',
      order: 'asc',
      format: 'display',
    })
    expect(result.success).toBe(true)
  })

  test('listRecordsQuerySchema accepts empty object', () => {
    const result = listRecordsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  test('listRecordsQuerySchema rejects invalid order', () => {
    const result = listRecordsQuerySchema.safeParse({ order: 'random' })
    expect(result.success).toBe(false)
  })

  test('listRecordsQuerySchema rejects invalid format', () => {
    const result = listRecordsQuerySchema.safeParse({ format: 'xml' })
    expect(result.success).toBe(false)
  })

  test('activityQuerySchema accepts valid action filter', () => {
    const result = activityQuerySchema.safeParse({ action: 'create' })
    expect(result.success).toBe(true)
  })

  test('activityQuerySchema rejects invalid action', () => {
    const result = activityQuerySchema.safeParse({ action: 'archive' })
    expect(result.success).toBe(false)
  })
})

describe('Comment Body Schema', () => {
  test('commentBodySchema accepts valid content', () => {
    const result = commentBodySchema.safeParse({ content: 'Hello world' })
    expect(result.success).toBe(true)
  })

  test('commentBodySchema rejects empty content', () => {
    const result = commentBodySchema.safeParse({ content: '' })
    expect(result.success).toBe(false)
  })

  test('commentBodySchema rejects content exceeding 10000 chars', () => {
    const result = commentBodySchema.safeParse({ content: 'a'.repeat(10_001) })
    expect(result.success).toBe(false)
  })
})
