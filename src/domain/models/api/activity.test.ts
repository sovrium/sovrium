/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  activityLogDetailSchema,
  activityLogSchema,
  activityLogUserSchema,
  activityPaginationSchema,
  getActivityLogResponseSchema,
  listActivityLogsResponseSchema,
} from './activity'

const validUser = { id: 'u1', name: 'Alice', email: 'alice@example.com' }

const validActivity = {
  id: 'act_1',
  createdAt: '2025-01-15T10:30:00Z',
  action: 'create' as const,
  tableName: 'tasks',
  recordId: 'rec_1',
  user: validUser,
}

describe('activityLogUserSchema', () => {
  test('accepts valid user', () => {
    expect(activityLogUserSchema.safeParse(validUser).success).toBe(true)
  })

  test('rejects missing fields', () => {
    expect(activityLogUserSchema.safeParse({ id: 'u1' }).success).toBe(false)
  })
})

describe('activityLogSchema', () => {
  test('accepts valid activity log entry', () => {
    expect(activityLogSchema.safeParse(validActivity).success).toBe(true)
  })

  test('accepts null user for system activities', () => {
    const result = activityLogSchema.safeParse({ ...validActivity, user: null })
    expect(result.success).toBe(true)
  })

  test('accepts optional userId', () => {
    const result = activityLogSchema.safeParse({ ...validActivity, userId: 'u1' })
    expect(result.success).toBe(true)
  })

  test('accepts numeric recordId', () => {
    const result = activityLogSchema.safeParse({ ...validActivity, recordId: 42 })
    expect(result.success).toBe(true)
  })

  test('rejects invalid action', () => {
    const result = activityLogSchema.safeParse({ ...validActivity, action: 'archive' })
    expect(result.success).toBe(false)
  })

  test('accepts all valid actions', () => {
    for (const action of ['create', 'update', 'delete', 'restore']) {
      expect(activityLogSchema.safeParse({ ...validActivity, action }).success).toBe(true)
    }
  })
})

describe('activityLogDetailSchema', () => {
  test('accepts activity with changes', () => {
    const result = activityLogDetailSchema.safeParse({
      ...validActivity,
      changes: { name: 'New Name' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts null changes', () => {
    const result = activityLogDetailSchema.safeParse({ ...validActivity, changes: null })
    expect(result.success).toBe(true)
  })
})

describe('activityPaginationSchema', () => {
  test('accepts valid pagination', () => {
    const result = activityPaginationSchema.safeParse({
      total: 100,
      page: 1,
      pageSize: 20,
      totalPages: 5,
    })
    expect(result.success).toBe(true)
  })
})

describe('Response Schemas', () => {
  test('listActivityLogsResponseSchema accepts valid response', () => {
    const result = listActivityLogsResponseSchema.safeParse({
      activities: [validActivity],
      pagination: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
    })
    expect(result.success).toBe(true)
  })

  test('getActivityLogResponseSchema accepts detail with changes', () => {
    const result = getActivityLogResponseSchema.safeParse({
      ...validActivity,
      changes: { status: 'done' },
    })
    expect(result.success).toBe(true)
  })
})
