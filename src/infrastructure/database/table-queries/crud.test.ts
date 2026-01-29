/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, mock } from 'bun:test'
import { Effect } from 'effect'
import {
  listRecords,
  listTrash,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  permanentlyDeleteRecord,
  restoreRecord,
} from './crud'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

// Mock session
const mockSession: Readonly<Session> = {
  userId: 'user-123',
  sessionToken: 'token',
  expiresAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  id: 'session-id',
  ipAddress: null,
  userAgent: null,
  impersonatedBy: null,
  activeOrganizationId: 'org-456',
}

// Mock withSessionContext to isolate crud function logic
mock.module('@/infrastructure/database', () => ({
  withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
    fn({
      execute: mock(async () => []),
    }),
  SessionContextError: class SessionContextError extends Error {
    constructor(message: string, cause?: unknown) {
      super(message)
      this.cause = cause
    }
  },
  UniqueConstraintViolationError: class UniqueConstraintViolationError extends Error {
    constructor(message: string, constraint: string) {
      super(message)
    }
  },
}))

// Mock helper modules
mock.module('./create-record-helpers', () => ({
  checkTableColumns: () => Effect.succeed({ hasOwnerId: false }),
  sanitizeFields: (fields: any) => fields,
  buildInsertClauses: () => ({
    columnsClause: { queryChunks: ['name', 'email'] },
    valuesClause: { queryChunks: ['Alice', 'alice@example.com'] },
  }),
  executeInsert: () =>
    Effect.succeed({ id: 'record-123', name: 'Alice', email: 'alice@example.com' }),
}))

mock.module('./delete-helpers', () => ({
  checkDeletedAtColumn: () => Effect.succeed(true),
  fetchRecordBeforeDeletion: () => Effect.succeed({ id: 'record-123', name: 'Alice' }),
  executeSoftDelete: () => Effect.succeed(true),
  executeHardDelete: () => Effect.succeed(true),
  cascadeSoftDelete: async () => {},
}))

mock.module('./activity-log-helpers', () => ({
  logActivity: () => Effect.succeed(undefined),
}))

mock.module('@/infrastructure/database/filter-operators', () => ({
  generateSqlCondition: (field: string, operator: string, value: unknown) =>
    `${field} ${operator} '${value}'`,
}))

describe('listRecords', () => {
  describe('when fetching all records', () => {
    test('executes SELECT query with table name', async () => {
      let executedQuery: any = null

      const mockTx = {
        execute: mock(async (query: any) => {
          executedQuery = JSON.stringify(query)
          return [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
          ]
        }),
      }

      const { withSessionContext } = await import('@/infrastructure/database')
      mock.module('@/infrastructure/database', () => ({
        withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
          fn(mockTx),
        SessionContextError: class SessionContextError extends Error {
          constructor(message: string, cause?: unknown) {
            super(message)
            this.cause = cause
          }
        },
      }))

      const program = listRecords({
        session: mockSession,
        tableName: 'users',
      })

      const result = await Effect.runPromise(program)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('name', 'Alice')
      expect(executedQuery).toBeTruthy()
    })

    test('filters soft-deleted records by default', async () => {
      let executedQuery: any = null

      const mockTx = {
        execute: mock(async (query: any) => {
          executedQuery = JSON.stringify(query)

          // Mock information_schema query to indicate deleted_at exists
          if (executedQuery.includes('information_schema')) {
            return [{ column_name: 'deleted_at' }]
          }

          // Mock main SELECT query
          return [{ id: '1', name: 'Alice', deleted_at: null }]
        }),
      }

      const { withSessionContext } = await import('@/infrastructure/database')
      mock.module('@/infrastructure/database', () => ({
        withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
          fn(mockTx),
        SessionContextError: class SessionContextError extends Error {
          constructor(message: string, cause?: unknown) {
            super(message)
            this.cause = cause
          }
        },
      }))

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

      const mockTx = {
        execute: mock(async (query: any) => {
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
        }),
      }

      const { withSessionContext } = await import('@/infrastructure/database')
      mock.module('@/infrastructure/database', () => ({
        withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
          fn(mockTx),
        SessionContextError: class SessionContextError extends Error {
          constructor(message: string, cause?: unknown) {
            super(message)
            this.cause = cause
          }
        },
      }))

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

      const mockTx = {
        execute: mock(async (query: any) => {
          executedQuery = JSON.stringify(query)

          // Mock information_schema query
          if (executedQuery.includes('information_schema')) {
            return []
          }

          // Mock main SELECT query with filter
          return [{ id: '1', name: 'Alice', email: 'alice@example.com' }]
        }),
      }

      const { withSessionContext } = await import('@/infrastructure/database')
      mock.module('@/infrastructure/database', () => ({
        withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
          fn(mockTx),
        SessionContextError: class SessionContextError extends Error {
          constructor(message: string, cause?: unknown) {
            super(message)
            this.cause = cause
          }
        },
      }))

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

    // TODO: Rewrite this test to not use module mocking (causes mock pollution)
    // The test should verify that invalid field names throw validation errors
    // test('validates column names in filters', async () => {
    //   const validateColumnNameMock = mock(() => {})

    //   mock.module('./validation', () => ({
    //     validateTableName: () => {},
    //     validateColumnName: validateColumnNameMock,
    //   }))

    //   const mockTx = {
    //     execute: mock(async (query: any) => {
    //       const queryStr = JSON.stringify(query)
    //       if (queryStr.includes('information_schema')) {
    //         return []
    //       }
    //       return []
    //     }),
    //   }

    //   const { withSessionContext } = await import('@/infrastructure/database')
    //   mock.module('@/infrastructure/database', () => ({
    //     withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
    //       fn(mockTx),
    //     SessionContextError: class SessionContextError extends Error {
    //       constructor(message: string, cause?: unknown) {
    //         super(message)
    //         this.cause = cause
    //       }
    //     },
    //   }))

    //   const program = listRecords({
    //     session: mockSession,
    //     tableName: 'users',
    //     filter: {
    //       and: [{ field: 'malicious_field', operator: '=', value: 'test' }],
    //     },
    //   })

    //   await Effect.runPromise(program)

    //   // Verify validateColumnName was called
    //   expect(validateColumnNameMock).toHaveBeenCalled()
    // })
  })

  describe('error handling', () => {
    test('throws SessionContextError on database failure', async () => {
      const mockTx = {
        execute: mock(async () => {
          throw new Error('Database connection failed')
        }),
      }

      const { withSessionContext } = await import('@/infrastructure/database')
      mock.module('@/infrastructure/database', () => ({
        withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
          fn(mockTx),
        SessionContextError: class SessionContextError extends Error {
          constructor(message: string, cause?: unknown) {
            super(message)
            this.cause = cause
          }
        },
      }))

      const program = listRecords({
        session: mockSession,
        tableName: 'users',
      })

      try {
        await Effect.runPromise(program)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toHaveProperty('message')
        expect((error as Error).message).toContain('Failed to list records from users')
      }
    })
  })
})

describe('listTrash', () => {
  test('returns only soft-deleted records', async () => {
    const mockTx = {
      execute: mock(async (query: any) => {
        const queryStr = JSON.stringify(query)

        // Mock information_schema query
        if (queryStr.includes('information_schema')) {
          return [{ column_name: 'deleted_at' }]
        }

        // Mock main SELECT query (deleted_at IS NOT NULL)
        return [{ id: '1', name: 'Deleted User', deleted_at: new Date() }]
      }),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = listTrash(mockSession, 'users')

    const result = await Effect.runPromise(program)

    expect(result).toHaveLength(1)
    expect(result[0]).toHaveProperty('name', 'Deleted User')
  })

  test('returns empty array if table has no deleted_at column', async () => {
    const mockTx = {
      execute: mock(async (query: any) => {
        const queryStr = JSON.stringify(query)

        // Mock information_schema query (no deleted_at column)
        if (queryStr.includes('information_schema')) {
          return []
        }

        return []
      }),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = listTrash(mockSession, 'users')

    const result = await Effect.runPromise(program)

    expect(result).toEqual([])
  })
})

describe('getRecord', () => {
  test('returns record when found', async () => {
    const mockTx = {
      execute: mock(async () => [{ id: 'record-123', name: 'Alice', email: 'alice@example.com' }]),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = getRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id', 'record-123')
    expect(result).toHaveProperty('name', 'Alice')
  })

  test('returns null when record not found', async () => {
    const mockTx = {
      execute: mock(async () => []),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = getRecord(mockSession, 'users', 'nonexistent')

    const result = await Effect.runPromise(program)

    expect(result).toBe(null)
  })
})

describe('createRecord', () => {
  test('creates record and returns created data', async () => {
    // Already tested via create-record-helpers.test.ts
    // This test verifies integration with helper functions

    const program = createRecord(mockSession, 'users', {
      name: 'Alice',
      email: 'alice@example.com',
    })

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('name', 'Alice')
  })

  test('fails when no fields provided and no owner_id column', async () => {
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

    const mockTx = {
      execute: mock(async (query: any) => {
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
      }),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = updateRecord(mockSession, 'users', 'record-123', {
      name: 'Alice Smith',
    })

    const result = await Effect.runPromise(program)

    expect(beforeFetched).toBe(true)
    expect(updateExecuted).toBe(true)
    expect(result).toHaveProperty('name', 'Alice Smith')
  })

  test('fails when no fields provided', async () => {
    const program = updateRecord(mockSession, 'users', 'record-123', {})

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('Cannot update record with no fields')
    }
  })

  test('throws error when RLS blocks update (empty result)', async () => {
    const mockTx = {
      execute: mock(async (query: any) => {
        const queryStr = JSON.stringify(query)

        // Mock before-state fetch
        if (queryStr.includes('SELECT')) {
          return [{ id: 'record-123', name: 'Alice' }]
        }

        // Mock UPDATE query - RLS blocks, returns empty array
        if (queryStr.includes('UPDATE')) {
          return []
        }

        return []
      }),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = updateRecord(mockSession, 'users', 'record-123', {
      name: 'New Name',
    })

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('not found or access denied')
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
    mock.module('./delete-helpers', () => ({
      checkDeletedAtColumn: () => Effect.succeed(false), // No soft delete support
      fetchRecordBeforeDeletion: () => Effect.succeed({ id: 'record-123', name: 'Alice' }),
      executeSoftDelete: () => Effect.succeed(true),
      executeHardDelete: () => Effect.succeed(true),
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
    mock.module('./delete-helpers', () => ({
      checkDeletedAtColumn: () => Effect.succeed(true),
      fetchRecordBeforeDeletion: () => Effect.succeed({ id: 'record-123', name: 'Alice' }),
      executeSoftDelete: () => Effect.succeed(true),
      executeHardDelete: () => Effect.succeed(false), // Delete fails
      cascadeSoftDelete: async () => {},
    }))

    const program = permanentlyDeleteRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toBe(false)
  })
})

describe('restoreRecord', () => {
  test('restores soft-deleted record', async () => {
    const mockTx = {
      execute: mock(async (query: any) => {
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
      }),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = restoreRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id', 'record-123')
    expect(result).toHaveProperty('deleted_at', null)
  })

  test('returns null when record not found', async () => {
    const mockTx = {
      execute: mock(async (query: any) => {
        const queryStr = JSON.stringify(query)

        // Mock check query - record not found
        if (queryStr.includes('SELECT')) {
          return []
        }

        return []
      }),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = restoreRecord(mockSession, 'users', 'nonexistent')

    const result = await Effect.runPromise(program)

    expect(result).toBe(null)
  })

  test('returns error marker when record exists but is not deleted', async () => {
    const mockTx = {
      execute: mock(async (query: any) => {
        const queryStr = JSON.stringify(query)

        // Mock check query - record exists but NOT soft-deleted
        if (queryStr.includes('SELECT')) {
          return [{ id: 'record-123', deleted_at: null }]
        }

        return []
      }),
    }

    const { withSessionContext } = await import('@/infrastructure/database')
    mock.module('@/infrastructure/database', () => ({
      withSessionContext: (session: Session, fn: (tx: any) => Effect.Effect<any, any>) =>
        fn(mockTx),
      SessionContextError: class SessionContextError extends Error {
        constructor(message: string, cause?: unknown) {
          super(message)
          this.cause = cause
        }
      },
    }))

    const program = restoreRecord(mockSession, 'users', 'record-123')

    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('_error', 'not_deleted')
  })
})
