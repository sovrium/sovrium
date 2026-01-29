/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, mock } from 'bun:test'
import { validateTable, enrichUserRole } from './table'
import type { App } from '@/domain/models/app'
import type { Context, Next } from 'hono'

// Mock getUserRole
mock.module('@/application/use-cases/tables/user-role', () => ({
  getUserRole: mock(async () => 'member'),
}))

// Helper to create a mock Hono context
function createMockContext(
  options: {
    tableId?: string | null
    session?: { userId: string; activeOrganizationId: string } | null
  } = {}
) {
  const setValues: Record<string, unknown> = {}
  const jsonResponses: Array<{ data: unknown; status: number }> = []

  return {
    req: {
      param: mock((name: string) => {
        if (name === 'tableId') return options.tableId ?? undefined
        return undefined
      }),
    },
    var: {
      session: options.session ?? undefined,
    },
    set: mock((key: string, value: unknown) => {
      setValues[key] = value
    }),
    json: mock((data: unknown, status: number) => {
      jsonResponses.push({ data, status })
      return { data, status } as unknown as Response
    }),
    getSetValues: () => setValues,
    getJsonResponses: () => jsonResponses,
  } as unknown as Context & {
    getSetValues: () => Record<string, unknown>
    getJsonResponses: () => Array<{ data: unknown; status: number }>
  }
}

// Mock next function with mutable state tracking
function createMockNext(): Next & { called: boolean } {
  const next = (async () => {
    next.called = true
  }) as Next & { called: boolean }
  next.called = false
  return next
}

// Sample app configuration for testing
const mockApp: App = {
  name: 'Test App',
  tables: [
    { id: 1, name: 'contacts', fields: [] },
    { id: 2, name: 'tasks', fields: [] },
  ],
}

describe('validateTable middleware', () => {
  describe('returns 400 Bad Request', () => {
    test('when tableId parameter is missing', async () => {
      const c = createMockContext({ tableId: null })
      const next = createMockNext()

      const middleware = validateTable(mockApp)
      await middleware(c, next)

      const responses = c.getJsonResponses()
      expect(responses).toHaveLength(1)
      expect(responses[0]?.status).toBe(400)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Table ID parameter required',
        code: 'VALIDATION_ERROR',
      })
      expect(next.called).toBe(false)
    })
  })

  describe('returns 404 Not Found', () => {
    test('when table does not exist in app schema', async () => {
      const c = createMockContext({ tableId: 'nonexistent' })
      const next = createMockNext()

      const middleware = validateTable(mockApp)
      await middleware(c, next)

      const responses = c.getJsonResponses()
      expect(responses).toHaveLength(1)
      expect(responses[0]?.status).toBe(404)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      })
      expect(next.called).toBe(false)
    })

    test('when app has no tables defined', async () => {
      const emptyApp: App = { name: 'Empty App' }
      const c = createMockContext({ tableId: 'contacts' })
      const next = createMockNext()

      const middleware = validateTable(emptyApp)
      await middleware(c, next)

      const responses = c.getJsonResponses()
      expect(responses).toHaveLength(1)
      expect(responses[0]?.status).toBe(404)
      expect(next.called).toBe(false)
    })
  })

  describe('validates and enriches context', () => {
    test('when table is found by name', async () => {
      const c = createMockContext({ tableId: 'contacts' })
      const next = createMockNext()

      const middleware = validateTable(mockApp)
      await middleware(c, next)

      const setValues = c.getSetValues()
      expect(setValues['tableName']).toBe('contacts')
      expect(setValues['tableId']).toBe('contacts')
      expect(next.called).toBe(true)
      expect(c.getJsonResponses()).toHaveLength(0)
    })

    test('when table is found by numeric id', async () => {
      const c = createMockContext({ tableId: '1' })
      const next = createMockNext()

      const middleware = validateTable(mockApp)
      await middleware(c, next)

      const setValues = c.getSetValues()
      expect(setValues['tableName']).toBe('contacts')
      expect(setValues['tableId']).toBe('1')
      expect(next.called).toBe(true)
    })

    test('when table is found by string id', async () => {
      const c = createMockContext({ tableId: '2' })
      const next = createMockNext()

      const middleware = validateTable(mockApp)
      await middleware(c, next)

      const setValues = c.getSetValues()
      expect(setValues['tableName']).toBe('tasks')
      expect(setValues['tableId']).toBe('2')
      expect(next.called).toBe(true)
    })
  })
})

describe('enrichUserRole middleware', () => {
  describe('returns 401 Unauthorized', () => {
    test('when session is missing from context', async () => {
      const c = createMockContext({ session: null })
      const next = createMockNext()

      const middleware = enrichUserRole()
      await middleware(c, next)

      const responses = c.getJsonResponses()
      expect(responses).toHaveLength(1)
      expect(responses[0]?.status).toBe(401)
      expect(responses[0]?.data).toMatchObject({
        success: false,
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      })
      expect(next.called).toBe(false)
    })
  })

  describe('enriches context with user role', () => {
    test('when session exists', async () => {
      const c = createMockContext({
        session: { userId: 'user-123', activeOrganizationId: 'org-456' },
      })
      const next = createMockNext()

      const middleware = enrichUserRole()
      await middleware(c, next)

      const setValues = c.getSetValues()
      expect(setValues['userRole']).toBe('member')
      expect(next.called).toBe(true)
      expect(c.getJsonResponses()).toHaveLength(0)
    })
  })
})
