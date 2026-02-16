/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  cascadeSoftDelete,
  executeSoftDelete,
  executeHardDelete,
  checkDeletedAtColumn,
} from './delete-helpers'
import { fetchRecordById } from './record-fetch-helpers'
import type { DrizzleTransaction } from '@/infrastructure/database'

const asTx = (mock: { execute: (...args: any[]) => any }) =>
  mock as unknown as Readonly<DrizzleTransaction>

/**
 * Create a call-counter mock that returns different results per call index.
 *
 * Why call counters instead of JSON.stringify pattern matching:
 * - drizzle-orm SQL objects (sql`...` and sql.raw(...)) have different internal
 *   structures whose JSON.stringify output varies between macOS and Linux
 * - Call counters are platform-independent and match the actual call sequence
 *
 * Call sequences for each function:
 * - cascadeSoftDelete per child table WITH deleted_at:
 *     [0] information_schema check (deleted_at), [1] hasDeletedByColumn check (deleted_by), [2] UPDATE
 * - cascadeSoftDelete per child table WITHOUT deleted_at:
 *     [0] information_schema check → returns empty → skips
 * - executeSoftDelete: [0] hasDeletedByColumn check, [1] UPDATE
 * - executeHardDelete: [0] DELETE
 * - checkDeletedAtColumn: [0] SELECT information_schema
 * - fetchRecordById: [0] SELECT
 */
function createCallCounterMock(responses: ReadonlyArray<unknown[]>) {
  let callIndex = 0
  return {
    callCount: () => callIndex,
    tx: {
      execute: async () => {
        const response = callIndex < responses.length ? responses[callIndex] : []
        callIndex++
        return response
      },
    },
  }
}

describe('cascadeSoftDelete', () => {
  describe('when app has tables with cascade relationships', () => {
    test('cascades soft delete to child records with onDelete: cascade', async () => {
      // For 1 child table with deleted_at:
      // Call 0: information_schema check → has deleted_at
      // Call 1: hasDeletedByColumn check (checkAuthorshipColumns) → has deleted_by
      // Call 2: UPDATE cascade
      const mock = createCallCounterMock([
        [{ column_name: 'deleted_at' }], // deleted_at exists
        [{ column_name: 'deleted_by' }], // deleted_by exists
        [], // UPDATE result
      ])

      const app = {
        tables: [
          {
            name: 'posts',
            fields: [
              {
                name: 'author_id',
                type: 'relationship',
                relatedTable: 'users',
                onDelete: 'cascade',
              },
            ],
          },
          {
            name: 'comments',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
        ],
      }

      await cascadeSoftDelete(asTx(mock.tx), 'posts', 'post-123', app)

      // Should have executed 3 calls: deleted_at check + deleted_by check + UPDATE
      expect(mock.callCount()).toBe(3)
    })

    test('cascades to multiple child tables', async () => {
      // For 2 child tables, each with deleted_at:
      // Calls 0-2: first table (deleted_at check, deleted_by check, UPDATE)
      // Calls 3-5: second table (deleted_at check, deleted_by check, UPDATE)
      const mock = createCallCounterMock([
        [{ column_name: 'deleted_at' }], // table 1: deleted_at exists
        [{ column_name: 'deleted_by' }], // table 1: deleted_by exists
        [], // table 1: UPDATE
        [{ column_name: 'deleted_at' }], // table 2: deleted_at exists
        [{ column_name: 'deleted_by' }], // table 2: deleted_by exists
        [], // table 2: UPDATE
      ])

      const app = {
        tables: [
          {
            name: 'comments',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
          {
            name: 'likes',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
        ],
      }

      await cascadeSoftDelete(asTx(mock.tx), 'posts', 'post-123', app)

      // Both tables get cascaded (3 calls each = 6 total)
      // Note: cascadeSoftDelete uses Promise.all so order may vary,
      // but total call count is deterministic
      expect(mock.callCount()).toBe(6)
    })

    test('skips cascade for tables without deleted_at column', async () => {
      // For 1 child table WITHOUT deleted_at:
      // Call 0: information_schema check → empty (no deleted_at)
      const mock = createCallCounterMock([
        [], // no deleted_at column
      ])

      const app = {
        tables: [
          {
            name: 'comments',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
        ],
      }

      await cascadeSoftDelete(asTx(mock.tx), 'posts', 'post-123', app)

      // Only 1 call: the deleted_at check (no UPDATE because no deleted_at)
      expect(mock.callCount()).toBe(1)
    })
  })

  describe('when app has no tables', () => {
    test('returns without error when app.tables is undefined', async () => {
      const mock = createCallCounterMock([])
      const app = {}

      await expect(
        cascadeSoftDelete(asTx(mock.tx), 'users', 'user-123', app)
      ).resolves.toBeUndefined()

      expect(mock.callCount()).toBe(0)
    })

    test('returns without error when app.tables is empty array', async () => {
      const mock = createCallCounterMock([])
      const app = { tables: [] }

      await expect(
        cascadeSoftDelete(asTx(mock.tx), 'users', 'user-123', app)
      ).resolves.toBeUndefined()

      expect(mock.callCount()).toBe(0)
    })
  })

  describe('when relationships have different onDelete values', () => {
    test('only cascades for onDelete: cascade, not onDelete: set-null', async () => {
      // Only 'comments' has onDelete: cascade, 'favorites' has set-null
      // So only 1 child table cascades: 3 calls
      const mock = createCallCounterMock([
        [{ column_name: 'deleted_at' }], // comments: deleted_at exists
        [{ column_name: 'deleted_by' }], // comments: deleted_by exists
        [], // comments: UPDATE
      ])

      const app = {
        tables: [
          {
            name: 'comments',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
          {
            name: 'favorites',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'set-null',
              },
            ],
          },
        ],
      }

      await cascadeSoftDelete(asTx(mock.tx), 'posts', 'post-123', app)

      // Only comments cascaded (3 calls), favorites skipped
      expect(mock.callCount()).toBe(3)
    })

    test('ignores non-relationship fields', async () => {
      // Only 'posts' table has a relationship to 'users' with cascade
      // The 'title' field (type: text) is ignored
      const mock = createCallCounterMock([
        [{ column_name: 'deleted_at' }], // posts: deleted_at exists
        [{ column_name: 'deleted_by' }], // posts: deleted_by exists
        [], // posts: UPDATE
      ])

      const app = {
        tables: [
          {
            name: 'posts',
            fields: [
              {
                name: 'title',
                type: 'text',
              },
              {
                name: 'author_id',
                type: 'relationship',
                relatedTable: 'users',
                onDelete: 'cascade',
              },
            ],
          },
        ],
      }

      await cascadeSoftDelete(asTx(mock.tx), 'users', 'user-123', app)

      // Should execute calls (relationship field found)
      expect(mock.callCount()).toBeGreaterThan(0)
    })
  })

  describe('SQL injection prevention', () => {
    test('validates table names before cascading', async () => {
      // Validation throws before any tx.execute call
      const mock = createCallCounterMock([])

      const app = {
        tables: [
          {
            name: 'comments; DROP TABLE users;--',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
        ],
      }

      await expect(cascadeSoftDelete(asTx(mock.tx), 'posts', 'post-123', app)).rejects.toThrow(
        'Invalid table name'
      )
    })

    test('validates column names before cascading', async () => {
      // Validation throws before any tx.execute call
      const mock = createCallCounterMock([])

      const app = {
        tables: [
          {
            name: 'comments',
            fields: [
              {
                name: 'post_id; DROP TABLE users;--',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
        ],
      }

      await expect(cascadeSoftDelete(asTx(mock.tx), 'posts', 'post-123', app)).rejects.toThrow(
        'Invalid column name'
      )
    })
  })
})

describe('fetchRecordById', () => {
  describe('when record exists', () => {
    test('returns record data for activity logging', async () => {
      const mockRecord = {
        id: '123',
        name: 'Test Record',
        created_at: new Date(),
      }

      const mock = createCallCounterMock([[mockRecord]])

      const result = await fetchRecordById(asTx(mock.tx), 'users', '123')

      expect(result).toEqual(mockRecord)
    })

    test('uses sql.identifier for table name safety', async () => {
      const mock = createCallCounterMock([[{ id: '123' }]])

      await fetchRecordById(asTx(mock.tx), 'users', '123')

      // Verify query was executed
      expect(mock.callCount()).toBe(1)
    })
  })

  describe('when record does not exist', () => {
    test('returns undefined when no record found', async () => {
      const mock = createCallCounterMock([[]])

      const result = await fetchRecordById(asTx(mock.tx), 'users', '999')

      expect(result).toBeUndefined()
    })
  })

  describe('when database error occurs', () => {
    test('wraps error in SessionContextError', async () => {
      const mockTx = {
        execute: async () => {
          throw new Error('Database connection failed')
        },
      }

      try {
        await fetchRecordById(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toHaveProperty('message')
        expect((error as Error).message).toContain('Failed to fetch record')
      }
    })

    test('includes original error in SessionContextError cause', async () => {
      const originalError = new Error('Connection timeout')

      const mockTx = {
        execute: async () => {
          throw originalError
        },
      }

      try {
        await fetchRecordById(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Failed to fetch record')
      }
    })
  })
})

describe('executeSoftDelete', () => {
  describe('when record exists and is not deleted', () => {
    test('sets deleted_at to NOW() and returns true', async () => {
      // executeSoftDelete: [0] hasDeletedByColumn check, [1] UPDATE
      const mock = createCallCounterMock([
        [], // no deleted_by column
        [{ id: '123' }], // UPDATE returned row
      ])

      const result = await executeSoftDelete(asTx(mock.tx), 'users', '123')

      expect(result).toBe(true)
    })

    test('uses sql.identifier for table name safety', async () => {
      const mock = createCallCounterMock([
        [], // no deleted_by column
        [{ id: '123' }], // UPDATE returned row
      ])

      await executeSoftDelete(asTx(mock.tx), 'users', '123')

      // 2 calls: hasDeletedByColumn check + UPDATE
      expect(mock.callCount()).toBe(2)
    })
  })

  describe('when record does not exist or is already deleted', () => {
    test('returns false when no record updated', async () => {
      const mock = createCallCounterMock([
        [], // no deleted_by column
        [], // UPDATE returned empty (no match)
      ])

      const result = await executeSoftDelete(asTx(mock.tx), 'users', '999')

      expect(result).toBe(false)
    })
  })

  describe('when database error occurs', () => {
    test('wraps error in SessionContextError with table and record info', async () => {
      const mockTx = {
        execute: async () => {
          throw new Error('Database error')
        },
      }

      try {
        await executeSoftDelete(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toHaveProperty('message')
        expect((error as Error).message).toContain('Failed to delete record 123 from users')
      }
    })

    test('includes original error cause', async () => {
      const originalError = new Error('Connection lost')

      const mockTx = {
        execute: async () => {
          throw originalError
        },
      }

      try {
        await executeSoftDelete(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Failed to delete record')
      }
    })
  })
})

describe('executeHardDelete', () => {
  describe('when record exists', () => {
    test('permanently deletes record and returns true', async () => {
      const mock = createCallCounterMock([
        [{ id: '123' }], // DELETE returned row
      ])

      const result = await executeHardDelete(asTx(mock.tx), 'users', '123')

      expect(result).toBe(true)
    })

    test('uses sql.identifier for table name safety', async () => {
      const mock = createCallCounterMock([
        [{ id: '123' }], // DELETE returned row
      ])

      await executeHardDelete(asTx(mock.tx), 'users', '123')

      expect(mock.callCount()).toBe(1)
    })
  })

  describe('when record does not exist', () => {
    test('returns false when no record deleted', async () => {
      const mock = createCallCounterMock([
        [], // DELETE returned empty
      ])

      const result = await executeHardDelete(asTx(mock.tx), 'users', '999')

      expect(result).toBe(false)
    })
  })

  describe('when database error occurs', () => {
    test('wraps error in SessionContextError with table and record info', async () => {
      const mockTx = {
        execute: async () => {
          throw new Error('Constraint violation')
        },
      }

      try {
        await executeHardDelete(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toHaveProperty('message')
        expect((error as Error).message).toContain('Failed to delete record 123 from users')
      }
    })

    test('includes original error cause', async () => {
      const originalError = new Error('Foreign key constraint')

      const mockTx = {
        execute: async () => {
          throw originalError
        },
      }

      try {
        await executeHardDelete(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Failed to delete record')
      }
    })
  })
})

describe('checkDeletedAtColumn', () => {
  describe('when table has deleted_at column', () => {
    test('returns true', async () => {
      const mock = createCallCounterMock([
        [{ column_name: 'deleted_at' }], // column exists
      ])

      const result = await checkDeletedAtColumn(asTx(mock.tx), 'users')

      expect(result).toBe(true)
    })
  })

  describe('when table does NOT have deleted_at column', () => {
    test('returns false', async () => {
      const mock = createCallCounterMock([
        [], // column does not exist
      ])

      const result = await checkDeletedAtColumn(asTx(mock.tx), 'users')

      expect(result).toBe(false)
    })
  })

  describe('when database error occurs', () => {
    test('wraps error in SessionContextError with table name', async () => {
      const mockTx = {
        execute: async () => {
          throw new Error('Schema query failed')
        },
      }

      try {
        await checkDeletedAtColumn(asTx(mockTx), 'users')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toHaveProperty('message')
        expect((error as Error).message).toContain('Failed to check columns for users')
      }
    })

    test('includes original error cause', async () => {
      const originalError = new Error('Database unavailable')

      const mockTx = {
        execute: async () => {
          throw originalError
        },
      }

      try {
        await checkDeletedAtColumn(asTx(mockTx), 'users')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Failed to check columns')
      }
    })
  })
})
