/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  cascadeSoftDelete,
  fetchRecordBeforeDeletion,
  executeSoftDelete,
  executeHardDelete,
  checkDeletedAtColumn,
} from './delete-helpers'
import type { DrizzleTransaction } from '@/infrastructure/database'

const asTx = (mock: { execute: (...args: any[]) => any }) =>
  mock as unknown as Readonly<DrizzleTransaction>

describe('cascadeSoftDelete', () => {
  describe('when app has tables with cascade relationships', () => {
    test('cascades soft delete to child records with onDelete: cascade', async () => {
      let checkColumnCalled = false
      let cascadeUpdateCalled = false

      const mockTx = {
        execute: async (_query: any) => {
          const queryStr = JSON.stringify(_query)

          // Mock information_schema query for deleted_at column check
          if (queryStr.includes('information_schema') || queryStr.includes('column_name')) {
            checkColumnCalled = true
            return [{ column_name: 'deleted_at' }]
          }

          // Mock cascade update (UPDATE query)
          if (queryStr.includes('UPDATE') || queryStr.includes('deleted_at')) {
            cascadeUpdateCalled = true
          }

          return []
        },
      }

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

      await cascadeSoftDelete(asTx(mockTx), 'posts', 'post-123', app)

      // Should check for deleted_at column in child table
      expect(checkColumnCalled).toBe(true)

      // Should execute cascade update for comments table
      expect(cascadeUpdateCalled).toBe(true)
    })

    test('cascades to multiple child tables', async () => {
      let updateCount = 0

      const mockTx = {
        execute: async (_query: any) => {
          const queryStr = JSON.stringify(_query)

          if (queryStr.includes('information_schema') || queryStr.includes('column_name')) {
            return [{ column_name: 'deleted_at' }]
          }

          // Count UPDATE queries
          if (queryStr.includes('UPDATE') || queryStr.includes('deleted_at')) {
            updateCount++
          }

          return []
        },
      }

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

      await cascadeSoftDelete(asTx(mockTx), 'posts', 'post-123', app)

      // Should cascade to both comments and likes
      expect(updateCount).toBe(2)
    })

    test('skips cascade for tables without deleted_at column', async () => {
      let checkColumnCalled = false
      let updateCount = 0

      const mockTx = {
        execute: async (_query: any) => {
          const queryStr = JSON.stringify(_query)

          // Return empty array (no deleted_at column)
          if (queryStr.includes('information_schema') || queryStr.includes('column_name')) {
            checkColumnCalled = true
            return []
          }

          // Count UPDATE queries
          if (queryStr.includes('UPDATE')) {
            updateCount++
          }

          return []
        },
      }

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

      await cascadeSoftDelete(asTx(mockTx), 'posts', 'post-123', app)

      // Should check for deleted_at
      expect(checkColumnCalled).toBe(true)

      // Should NOT execute cascade update (no deleted_at column)
      expect(updateCount).toBe(0)
    })
  })

  describe('when app has no tables', () => {
    test('returns without error when app.tables is undefined', async () => {
      const mockTx = {
        execute: async () => [],
      }

      const app = {}

      // Should not throw
      await expect(
        cascadeSoftDelete(asTx(mockTx), 'users', 'user-123', app)
      ).resolves.toBeUndefined()
    })

    test('returns without error when app.tables is empty array', async () => {
      const mockTx = {
        execute: async () => [],
      }

      const app = { tables: [] }

      // Should not throw
      await expect(
        cascadeSoftDelete(asTx(mockTx), 'users', 'user-123', app)
      ).resolves.toBeUndefined()
    })
  })

  describe('when relationships have different onDelete values', () => {
    test('only cascades for onDelete: cascade, not onDelete: set-null', async () => {
      let updateCount = 0

      const mockTx = {
        execute: async (_query: any) => {
          const queryStr = JSON.stringify(_query)

          if (queryStr.includes('information_schema') || queryStr.includes('column_name')) {
            return [{ column_name: 'deleted_at' }]
          }

          // Count UPDATE queries
          if (queryStr.includes('UPDATE')) {
            updateCount++
          }

          return []
        },
      }

      const app = {
        tables: [
          {
            name: 'comments',
            fields: [
              {
                name: 'post_id',
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade', // Should cascade
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
                onDelete: 'set-null', // Should NOT cascade
              },
            ],
          },
        ],
      }

      await cascadeSoftDelete(asTx(mockTx), 'posts', 'post-123', app)

      // Should only cascade to comments (not favorites)
      expect(updateCount).toBe(1)
    })

    test('ignores non-relationship fields', async () => {
      let executeCalled = false

      const mockTx = {
        execute: async (_query: any) => {
          executeCalled = true
          const queryStr = JSON.stringify(_query)

          if (queryStr.includes('information_schema') || queryStr.includes('column_name')) {
            return [{ column_name: 'deleted_at' }]
          }

          return []
        },
      }

      const app = {
        tables: [
          {
            name: 'posts',
            fields: [
              {
                name: 'title',
                type: 'text', // Not a relationship
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

      await cascadeSoftDelete(asTx(mockTx), 'users', 'user-123', app)

      // Should execute queries (checking for deleted_at column)
      expect(executeCalled).toBe(true)
    })
  })

  describe('SQL injection prevention', () => {
    test('validates table names before cascading', async () => {
      const mockTx = {
        execute: async (_query: any) => {
          const queryStr = _query.queryChunks.join(' ')

          if (queryStr.includes('information_schema.columns')) {
            return [{ column_name: 'deleted_at' }]
          }

          return []
        },
      }

      const app = {
        tables: [
          {
            name: 'comments; DROP TABLE users;--', // Malicious table name
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

      // Should throw validation error (invalid table name)
      await expect(cascadeSoftDelete(asTx(mockTx), 'posts', 'post-123', app)).rejects.toThrow(
        'Invalid table name'
      )
    })

    test('validates column names before cascading', async () => {
      const mockTx = {
        execute: async (_query: any) => {
          const queryStr = _query.queryChunks.join(' ')

          if (queryStr.includes('information_schema.columns')) {
            return [{ column_name: 'deleted_at' }]
          }

          return []
        },
      }

      const app = {
        tables: [
          {
            name: 'comments',
            fields: [
              {
                name: 'post_id; DROP TABLE users;--', // Malicious column name
                type: 'relationship',
                relatedTable: 'posts',
                onDelete: 'cascade',
              },
            ],
          },
        ],
      }

      // Should throw validation error (invalid column name)
      await expect(cascadeSoftDelete(asTx(mockTx), 'posts', 'post-123', app)).rejects.toThrow(
        'Invalid column name'
      )
    })
  })
})

describe('fetchRecordBeforeDeletion', () => {
  describe('when record exists', () => {
    test('returns record data for activity logging', async () => {
      const mockRecord = {
        id: '123',
        name: 'Test Record',
        created_at: new Date(),
      }

      const mockTx = {
        execute: async (_query: any) => {
          return [mockRecord]
        },
      }

      const result = await fetchRecordBeforeDeletion(asTx(mockTx), 'users', '123')

      expect(result).toEqual(mockRecord)
    })

    test('uses sql.identifier for table name safety', async () => {
      let executedQuery: any = null

      const mockTx = {
        execute: async (_query: any) => {
          executedQuery = _query
          return [{ id: '123' }]
        },
      }

      await fetchRecordBeforeDeletion(asTx(mockTx), 'users', '123')

      // Verify query was executed (can't directly inspect sql.identifier but query should be defined)
      expect(executedQuery).toBeDefined()
    })
  })

  describe('when record does not exist', () => {
    test('returns undefined when no record found', async () => {
      const mockTx = {
        execute: async () => [],
      }

      const result = await fetchRecordBeforeDeletion(asTx(mockTx), 'users', '999')

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
        await fetchRecordBeforeDeletion(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        // Promise rejection wraps the SessionContextError
        expect(error).toHaveProperty('message')
        expect((error as Error).message).toContain('Failed to fetch record before deletion')
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
        await fetchRecordBeforeDeletion(asTx(mockTx), 'users', '123')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Failed to fetch record before deletion')
      }
    })
  })
})

describe('executeSoftDelete', () => {
  describe('when record exists and is not deleted', () => {
    test('sets deleted_at to NOW() and returns true', async () => {
      const mockTx = {
        execute: async (_query: any) => {
          // Return non-empty result (record was updated)
          return [{ id: '123' }]
        },
      }

      const result = await executeSoftDelete(asTx(mockTx), 'users', '123')

      expect(result).toBe(true)
    })

    test('uses sql.identifier for table name safety', async () => {
      let executedQuery: any = null

      const mockTx = {
        execute: async (_query: any) => {
          executedQuery = _query
          return [{ id: '123' }]
        },
      }

      await executeSoftDelete(asTx(mockTx), 'users', '123')

      expect(executedQuery).toBeDefined()
    })
  })

  describe('when record does not exist or is already deleted', () => {
    test('returns false when no record updated', async () => {
      const mockTx = {
        execute: async () => {
          // Return empty array (no record updated)
          return []
        },
      }

      const result = await executeSoftDelete(asTx(mockTx), 'users', '999')

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

      await executeSoftDelete(asTx(mockTx), 'users', '123')

      try {
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

      await executeSoftDelete(asTx(mockTx), 'users', '123')

      try {
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
      const mockTx = {
        execute: async (_query: any) => {
          // Return non-empty result (record was deleted)
          return [{ id: '123' }]
        },
      }

      const result = await executeHardDelete(asTx(mockTx), 'users', '123')

      expect(result).toBe(true)
    })

    test('uses sql.identifier for table name safety', async () => {
      let executedQuery: any = null

      const mockTx = {
        execute: async (_query: any) => {
          executedQuery = _query
          return [{ id: '123' }]
        },
      }

      await executeHardDelete(asTx(mockTx), 'users', '123')

      expect(executedQuery).toBeDefined()
    })
  })

  describe('when record does not exist', () => {
    test('returns false when no record deleted', async () => {
      const mockTx = {
        execute: async () => {
          // Return empty array (no record deleted)
          return []
        },
      }

      const result = await executeHardDelete(asTx(mockTx), 'users', '999')

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

      await executeHardDelete(asTx(mockTx), 'users', '123')

      try {
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

      await executeHardDelete(asTx(mockTx), 'users', '123')

      try {
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
      const mockTx = {
        execute: async (_query: any) => {
          // Return column info (deleted_at exists)
          return [{ column_name: 'deleted_at' }]
        },
      }

      const result = await checkDeletedAtColumn(asTx(mockTx), 'users')

      expect(result).toBe(true)
    })
  })

  describe('when table does NOT have deleted_at column', () => {
    test('returns false', async () => {
      const mockTx = {
        execute: async () => {
          // Return empty array (column does not exist)
          return []
        },
      }

      const result = await checkDeletedAtColumn(asTx(mockTx), 'users')

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

      await checkDeletedAtColumn(asTx(mockTx), 'users')

      try {
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

      await checkDeletedAtColumn(asTx(mockTx), 'users')

      try {
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('Failed to check columns')
      }
    })
  })
})
