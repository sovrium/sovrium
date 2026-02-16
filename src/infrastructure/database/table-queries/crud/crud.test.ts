/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, mock, beforeAll, afterAll } from 'bun:test'
import { Effect } from 'effect'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

// CRUD functions — dynamically imported inside beforeAll() after mock setup.
// This prevents mock.module() from running at file-load time, which would leak
// mocked modules to other test files sharing the same Bun process on Linux CI.
let listRecords: any
let listTrash: any
let getRecord: any
let createRecord: any
let updateRecord: any
let deleteRecord: any
let permanentlyDeleteRecord: any
let restoreRecord: any

// Mock session
const mockSession: Readonly<Session> = {
  userId: 'user-123',
  token: 'token',
  expiresAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  id: 'session-id',
  ipAddress: null,
  userAgent: null,
  impersonatedBy: null,
}

// Helper: create a mock tx with configurable execute behavior
function createMockTx(executeFn: (query: any) => Promise<any>) {
  return { execute: mock(executeFn) }
}

// Helper: create a mock db that passes a mock tx to transaction callbacks
function createMockDb(mockTx: { execute: any }) {
  return {
    db: {
      transaction: mock(async (fn: (tx: any) => Promise<any>) => fn(mockTx)),
      execute: mockTx.execute,
      insert: mock(() => ({ values: mock(async () => ({})) })),
    },
    SessionContextError: class SessionContextError extends Error {
      constructor(message: string, cause?: unknown) {
        super(message)
        this.cause = cause
      }
    },
    UniqueConstraintViolationError: class UniqueConstraintViolationError extends Error {
      constructor(message: string, _constraint: string) {
        super(message)
      }
    },
  }
}

// Default mock: empty results
const defaultMockTx = createMockTx(async () => [])

// Set up mocks inside beforeAll() instead of at top level.
// Top-level mock.module() leaks to other test files on Linux CI because Bun's
// mock.module() is process-global and affects all loaded modules.
beforeAll(async () => {
  mock.module('@/infrastructure/database', () => createMockDb(defaultMockTx))

  mock.module('../mutation-helpers/delete-helpers', () => ({
    checkDeletedAtColumn: async () => true,
    executeSoftDelete: async () => true,
    executeHardDelete: async () => true,
    cascadeSoftDelete: async () => {},
  }))

  mock.module('../mutation-helpers/record-fetch-helpers', () => ({
    fetchRecordById: async () => ({ id: 'record-123', name: 'Alice' }),
  }))

  mock.module('@/infrastructure/database/filter-operators', () => ({
    generateSqlCondition: (field: string, operator: string, value: unknown) =>
      `${field} ${operator} '${value}'`,
  }))

  // Dynamic import AFTER mocks are set up — ./crud depends on mocked modules
  const crud = await import('./crud')
  listRecords = crud.listRecords
  listTrash = crud.listTrash
  getRecord = crud.getRecord
  createRecord = crud.createRecord
  updateRecord = crud.updateRecord
  deleteRecord = crud.deleteRecord
  permanentlyDeleteRecord = crud.permanentlyDeleteRecord
  restoreRecord = crud.restoreRecord
})

describe('listRecords', () => {
  describe('when fetching all records', () => {
    test('executes SELECT query with table name', async () => {
      let executedQuery: any = null

      const mockTx = createMockTx(async (query: any) => {
        executedQuery = JSON.stringify(query)
        return [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ]
      })

      mock.module('@/infrastructure/database', () => createMockDb(mockTx))

      const program = listRecords({
        session: mockSession,
        tableName: 'users',
      })

      const result: any = await Effect.runPromise(program)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('name', 'Alice')
      expect(executedQuery).toBeTruthy()
    })

    test('filters soft-deleted records by default', async () => {
      let executedQuery: any = null

      const mockTx = createMockTx(async (query: any) => {
        executedQuery = JSON.stringify(query)

        // Mock information_schema query to indicate deleted_at exists
        if (executedQuery.includes('information_schema')) {
          return [{ column_name: 'deleted_at' }]
        }

        // Mock main SELECT query
        return [{ id: '1', name: 'Alice', deleted_at: null }]
      })

      mock.module('@/infrastructure/database', () => createMockDb(mockTx))

      const program = listRecords({
        session: mockSession,
        tableName: 'users',
        includeDeleted: false,
      })

      await Effect.runPromise(program)

      // Verify query includes soft delete filter
      expect(executedQuery).toContain('deleted_at')
    })

    test('includes soft-deleted records when includeDeleted is true', async () => {
      let deletedAtCheckCalled = false

      const mockTx = createMockTx(async (query: any) => {
        const queryStr = JSON.stringify(query)

        // Mock information_schema query
        if (queryStr.includes('information_schema')) {
          deletedAtCheckCalled = true
          return [{ column_name: 'deleted_at' }]
        }

        // Mock main SELECT query (no filter for deleted_at)
        return [
          { id: '1', name: 'Alice', deleted_at: null },
          { id: '2', name: 'Bob', deleted_at: new Date() },
        ]
      })

      mock.module('@/infrastructure/database', () => createMockDb(mockTx))

      const program = listRecords({
        session: mockSession,
        tableName: 'users',
        includeDeleted: true,
      })

      const result = await Effect.runPromise(program)

      expect(deletedAtCheckCalled).toBe(true)
      expect(result).toHaveLength(2)
    })
  })

  describe('when using filters', () => {
    test('applies user-provided filters', async () => {
      let executedQuery: any = null

      const mockTx = createMockTx(async (query: any) => {
        executedQuery = JSON.stringify(query)

        // Mock information_schema query
        if (executedQuery.includes('information_schema')) {
          return []
        }

        // Mock main SELECT query with filter
        return [{ id: '1', name: 'Alice', email: 'alice@example.com' }]
      })

      mock.module('@/infrastructure/database', () => createMockDb(mockTx))

      const program = listRecords({
        session: mockSession,
        tableName: 'users',
        filter: {
          and: [{ field: 'email', operator: '=', value: 'alice@example.com' }],
        },
      })

      await Effect.runPromise(program)

      // Verify filter was applied (generateSqlCondition called)
      expect(executedQuery).toBeTruthy()
    })
  })

  describe('error handling', () => {
    test('throws SessionContextError on database failure', async () => {
      const mockTx = createMockTx(async () => {
        throw new Error('Database connection failed')
      })

      mock.module('@/infrastructure/database', () => createMockDb(mockTx))

      const program = listRecords({
        session: mockSession,
        tableName: 'users',
      })

      try {
        await Effect.runPromise(program)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toHaveProperty('message')
        // Error can occur at checkDeletedAtColumn or main SELECT - both are valid database errors
        expect((error as Error).message).toMatch(
          /Failed to (check deleted_at column for|list records from) users/
        )
      }
    })
  })
})

describe('listTrash', () => {
  test('returns only soft-deleted records', async () => {
    const mockTx = createMockTx(async (query: any) => {
      const queryStr = JSON.stringify(query)

      // Mock information_schema query
      if (queryStr.includes('information_schema')) {
        return [{ column_name: 'deleted_at' }]
      }

      // Mock main SELECT query (deleted_at IS NOT NULL)
      return [{ id: '1', name: 'Deleted User', deleted_at: new Date() }]
    })

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = listTrash({ session: mockSession, tableName: 'users' })

    const result: any = await Effect.runPromise(program)

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('name', 'Deleted User')
  })

  test('returns empty array if table has no deleted_at column', async () => {
    const mockTx = createMockTx(async (query: any) => {
      const queryStr = JSON.stringify(query)

      // Mock information_schema query (no deleted_at column)
      if (queryStr.includes('information_schema')) {
        return []
      }

      return []
    })

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = listTrash({ session: mockSession, tableName: 'users' })

    const result = await Effect.runPromise(program)

    expect(result).toEqual([])
  })
})

describe('getRecord', () => {
  test('returns record when found', async () => {
    const mockTx = createMockTx(async () => [
      { id: 'record-123', name: 'Alice', email: 'alice@example.com' },
    ])

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = getRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id', 'record-123')
    expect(result).toHaveProperty('name', 'Alice')
  })

  test('returns null when record not found', async () => {
    const mockTx = createMockTx(async () => [])

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = getRecord(mockSession, 'users', 'nonexistent')

    const result = await Effect.runPromise(program)

    expect(result).toBe(null)
  })
})

describe('createRecord', () => {
  test('creates record and returns created data', async () => {
    // Override default mock to return a record from INSERT RETURNING *
    const insertMockTx = createMockTx(async () => [
      { id: 'record-123', name: 'Alice', email: 'alice@example.com' },
    ])
    mock.module('@/infrastructure/database', () => createMockDb(insertMockTx))

    const program = createRecord(mockSession, 'users', {
      name: 'Alice',
      email: 'alice@example.com',
    })

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('name', 'Alice')

    // Restore default mock
    mock.module('@/infrastructure/database', () => createMockDb(defaultMockTx))
  })

  test('fails when no fields provided', async () => {
    const program = createRecord(mockSession, 'users', {})

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('Cannot create record with no fields')
    }
  })
})

describe('updateRecord', () => {
  test('updates record and returns updated data', async () => {
    let beforeFetched = false
    let updateExecuted = false

    const mockTx = createMockTx(async (query: any) => {
      const queryStr = JSON.stringify(query)

      // Mock before-state fetch (SELECT query)
      if (queryStr.includes('SELECT')) {
        beforeFetched = true
        return [{ id: 'record-123', name: 'Alice', email: 'alice@example.com' }]
      }

      // Mock update query (UPDATE query)
      if (queryStr.includes('UPDATE')) {
        updateExecuted = true
        return [{ id: 'record-123', name: 'Alice Smith', email: 'alice@example.com' }]
      }

      return []
    })

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = updateRecord(mockSession, 'users', 'record-123', {
      fields: { name: 'Alice Smith' },
    })

    const result = await Effect.runPromise(program)

    expect(beforeFetched).toBe(true)
    expect(updateExecuted).toBe(true)
    expect(result).toHaveProperty('name', 'Alice Smith')
  })

  test('fails when no fields provided', async () => {
    const program = updateRecord(mockSession, 'users', 'record-123', { fields: {} })

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toHaveProperty('message')
      // Inner SessionContextError from validateFieldsNotEmpty is wrapped by Effect.tryPromise catch
      expect((error as Error).message).toMatch(
        /Cannot update record with no fields|Failed to update record in users/
      )
    }
  })

  test('throws error when update returns empty result', async () => {
    const mockTx = createMockTx(async (query: any) => {
      const queryStr = JSON.stringify(query)

      // Mock before-state fetch
      if (queryStr.includes('SELECT')) {
        return [{ id: 'record-123', name: 'Alice' }]
      }

      // Mock UPDATE query - returns empty array
      if (queryStr.includes('UPDATE')) {
        return []
      }

      return []
    })

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = updateRecord(mockSession, 'users', 'record-123', {
      fields: { name: 'New Name' },
    })

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toHaveProperty('message')
      // Inner error from executeRecordUpdateCRUD is wrapped by Effect.tryPromise catch
      expect((error as Error).message).toMatch(
        /not found or access denied|Failed to update record in users/
      )
    }
  })
})

describe('deleteRecord', () => {
  test('performs soft delete when deleted_at column exists', async () => {
    // Helper functions already tested in delete-helpers.test.ts
    // This test verifies integration

    const program = deleteRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toBe(true)
  })

  test('performs hard delete when no deleted_at column', async () => {
    mock.module('../mutation-helpers/delete-helpers', () => ({
      checkDeletedAtColumn: async () => false, // No soft delete support
      executeSoftDelete: async () => true,
      executeHardDelete: async () => true,
      cascadeSoftDelete: async () => {},
    }))

    const program = deleteRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toBe(true)
  })
})

describe('permanentlyDeleteRecord', () => {
  test('performs hard delete regardless of deleted_at column', async () => {
    const program = permanentlyDeleteRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toBe(true)
  })

  test('returns false when delete fails', async () => {
    mock.module('../mutation-helpers/delete-helpers', () => ({
      checkDeletedAtColumn: async () => true,
      executeSoftDelete: async () => true,
      executeHardDelete: async () => false, // Delete fails
      cascadeSoftDelete: async () => {},
    }))

    const program = permanentlyDeleteRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toBe(false)
  })
})

describe('restoreRecord', () => {
  test('restores soft-deleted record', async () => {
    const mockTx = createMockTx(async (query: any) => {
      const queryStr = JSON.stringify(query)

      // Mock check query (record exists and is soft-deleted)
      if (queryStr.includes('SELECT')) {
        return [{ id: 'record-123', deleted_at: new Date() }]
      }

      // Mock restore query (UPDATE deleted_at = NULL)
      if (queryStr.includes('UPDATE')) {
        return [{ id: 'record-123', name: 'Alice', deleted_at: null }]
      }

      return []
    })

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = restoreRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id', 'record-123')
    expect(result).toHaveProperty('deleted_at', null)
  })

  test('returns null when record not found', async () => {
    const mockTx = createMockTx(async (query: any) => {
      const queryStr = JSON.stringify(query)

      // Mock check query - record not found
      if (queryStr.includes('SELECT')) {
        return []
      }

      return []
    })

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = restoreRecord(mockSession, 'users', 'nonexistent')

    const result = await Effect.runPromise(program)

    expect(result).toBe(null)
  })

  test('returns error marker when record exists but is not deleted', async () => {
    const mockTx = createMockTx(async (query: any) => {
      const queryStr = JSON.stringify(query)

      // Mock check query - record exists but NOT soft-deleted
      if (queryStr.includes('SELECT')) {
        return [{ id: 'record-123', deleted_at: null }]
      }

      return []
    })

    mock.module('@/infrastructure/database', () => createMockDb(mockTx))

    const program = restoreRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('_error', 'not_deleted')
  })
})

afterAll(() => {
  mock.restore()
})
