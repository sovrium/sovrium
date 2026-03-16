/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  commentPaginationSchema,
  commentSchema,
  commentUserSchema,
  createCommentResponseSchema,
  getCommentResponseSchema,
  getRecordHistoryResponseSchema,
  listCommentsResponseSchema,
  recordHistoryEntrySchema,
  updateCommentResponseSchema,
} from './comments'

const validUser = { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null }

const validComment = {
  id: 'cmt_1',
  content: 'Great work!',
  userId: 'u1',
  recordId: 'rec_1',
  tableId: 'tbl_1',
  createdAt: '2025-01-15T10:30:00Z',
  updatedAt: '2025-01-15T10:30:00Z',
  user: validUser,
}

describe('commentUserSchema', () => {
  test('accepts valid user with image', () => {
    expect(
      commentUserSchema.safeParse({ ...validUser, image: 'https://img.co/a.png' }).success
    ).toBe(true)
  })

  test('accepts null image', () => {
    expect(commentUserSchema.safeParse(validUser).success).toBe(true)
  })

  test('accepts missing image (optional)', () => {
    const { image: _, ...noImage } = validUser
    expect(commentUserSchema.safeParse(noImage).success).toBe(true)
  })
})

describe('commentSchema', () => {
  test('accepts valid comment', () => {
    expect(commentSchema.safeParse(validComment).success).toBe(true)
  })

  test('accepts numeric recordId and tableId', () => {
    const result = commentSchema.safeParse({ ...validComment, recordId: 42, tableId: 1 })
    expect(result.success).toBe(true)
  })

  test('rejects missing content', () => {
    const { content: _, ...noContent } = validComment
    expect(commentSchema.safeParse(noContent).success).toBe(false)
  })
})

describe('commentPaginationSchema', () => {
  test('accepts valid pagination', () => {
    const result = commentPaginationSchema.safeParse({
      total: 50,
      limit: 20,
      offset: 0,
      hasMore: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('Response Schemas', () => {
  test('listCommentsResponseSchema accepts valid response', () => {
    const result = listCommentsResponseSchema.safeParse({
      comments: [validComment],
      pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
    })
    expect(result.success).toBe(true)
  })

  test('getCommentResponseSchema accepts single comment', () => {
    expect(getCommentResponseSchema.safeParse(validComment).success).toBe(true)
  })

  test('createCommentResponseSchema wraps comment in object', () => {
    const result = createCommentResponseSchema.safeParse({ comment: validComment })
    expect(result.success).toBe(true)
  })

  test('updateCommentResponseSchema accepts comment directly', () => {
    expect(updateCommentResponseSchema.safeParse(validComment).success).toBe(true)
  })
})

describe('recordHistoryEntrySchema', () => {
  const validEntry = {
    id: 'act_1',
    action: 'update' as const,
    tableName: 'tasks',
    recordId: 'rec_1',
    changes: { status: 'done' },
    createdAt: '2025-01-15T10:30:00Z',
    user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
  }

  test('accepts valid history entry', () => {
    expect(recordHistoryEntrySchema.safeParse(validEntry).success).toBe(true)
  })

  test('accepts null changes and null user', () => {
    const result = recordHistoryEntrySchema.safeParse({ ...validEntry, changes: null, user: null })
    expect(result.success).toBe(true)
  })

  test('accepts optional userId', () => {
    const result = recordHistoryEntrySchema.safeParse({ ...validEntry, userId: 'u1' })
    expect(result.success).toBe(true)
  })
})

describe('getRecordHistoryResponseSchema', () => {
  test('accepts response with pagination', () => {
    const result = getRecordHistoryResponseSchema.safeParse({
      history: [],
      pagination: { total: 0, limit: 20, offset: 0 },
    })
    expect(result.success).toBe(true)
  })

  test('accepts response without pagination', () => {
    const result = getRecordHistoryResponseSchema.safeParse({ history: [] })
    expect(result.success).toBe(true)
  })
})
