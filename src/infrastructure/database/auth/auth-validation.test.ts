/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import {
  needsUsersTable,
  needsUpdatedByTrigger,
  ensureBetterAuthUsersTable,
  ensureUpdatedByTriggerFunction,
  BetterAuthUsersTableRequired,
} from './auth-validation'
import type { Table } from '@/domain/models/app/table'

describe('needsUsersTable', () => {
  describe('when tables have user reference fields', () => {
    test('returns true when table has user field', () => {
      const tables: Table[] = [
        {
          name: 'tasks',
          slug: 'tasks',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'assignee', slug: 'assignee', type: 'user', order: 1 },
          ],
          order: 0,
        },
      ] as any

      const result = needsUsersTable(tables)

      expect(result).toBe(true)
    })

    test('returns true when table has created-by field', () => {
      const tables: Table[] = [
        {
          name: 'posts',
          slug: 'posts',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'created_by', slug: 'created_by', type: 'created-by', order: 1 },
          ],
          order: 0,
        },
      ] as any

      expect(needsUsersTable(tables)).toBe(true)
    })

    test('returns true when table has updated-by field', () => {
      const tables: Table[] = [
        {
          name: 'documents',
          slug: 'documents',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'updated_by', slug: 'updated_by', type: 'updated-by', order: 1 },
          ],
          order: 0,
        },
      ] as any

      expect(needsUsersTable(tables)).toBe(true)
    })

    test('returns true when table has deleted-by field', () => {
      const tables: Table[] = [
        {
          name: 'records',
          slug: 'records',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'deleted_by', slug: 'deleted_by', type: 'deleted-by', order: 1 },
          ],
          order: 0,
        },
      ] as any

      expect(needsUsersTable(tables)).toBe(true)
    })

    test('returns true when multiple tables have user fields', () => {
      const tables: Table[] = [
        {
          name: 'tasks',
          slug: 'tasks',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'assignee', slug: 'assignee', type: 'user', order: 1 },
          ],
          order: 0,
        },
        {
          name: 'posts',
          slug: 'posts',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'author', slug: 'author', type: 'created-by', order: 1 },
          ],
          order: 1,
        },
      ] as any

      expect(needsUsersTable(tables)).toBe(true)
    })
  })

  describe('when tables do NOT have user reference fields', () => {
    test('returns false for tables with only basic fields', () => {
      const tables: Table[] = [
        {
          name: 'products',
          slug: 'products',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'name', slug: 'name', type: 'text', order: 1 },
            { name: 'price', slug: 'price', type: 'number', order: 2 },
          ],
          order: 0,
        },
      ] as any

      expect(needsUsersTable(tables)).toBe(false)
    })

    test('returns false for empty tables array', () => {
      const tables: Table[] = []

      expect(needsUsersTable(tables)).toBe(false)
    })
  })
})

describe('needsUpdatedByTrigger', () => {
  describe('when tables have updated-by fields', () => {
    test('returns true when table has updated-by field', () => {
      const tables: Table[] = [
        {
          name: 'documents',
          slug: 'documents',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'updated_by', slug: 'updated_by', type: 'updated-by', order: 1 },
          ],
          order: 0,
        },
      ] as any

      expect(needsUpdatedByTrigger(tables)).toBe(true)
    })

    test('returns true when multiple tables have updated-by fields', () => {
      const tables: Table[] = [
        {
          name: 'documents',
          slug: 'documents',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'updated_by', slug: 'updated_by', type: 'updated-by', order: 1 },
          ],
          order: 0,
        },
        {
          name: 'tasks',
          slug: 'tasks',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'last_modified_by', slug: 'last_modified_by', type: 'updated-by', order: 1 },
          ],
          order: 1,
        },
      ] as any

      expect(needsUpdatedByTrigger(tables)).toBe(true)
    })
  })

  describe('when tables do NOT have updated-by fields', () => {
    test('returns false for tables with only created-by fields', () => {
      const tables: Table[] = [
        {
          name: 'posts',
          slug: 'posts',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'created_by', slug: 'created_by', type: 'created-by', order: 1 },
          ],
          order: 0,
        },
      ] as any

      expect(needsUpdatedByTrigger(tables)).toBe(false)
    })

    test('returns false for tables with user fields but no updated-by', () => {
      const tables: Table[] = [
        {
          name: 'tasks',
          slug: 'tasks',
          fields: [
            { name: 'id', slug: 'id', type: 'auto-increment', order: 0 },
            { name: 'assignee', slug: 'assignee', type: 'user', order: 1 },
            { name: 'deleted_by', slug: 'deleted_by', type: 'deleted-by', order: 2 },
          ],
          order: 0,
        },
      ] as any

      expect(needsUpdatedByTrigger(tables)).toBe(false)
    })

    test('returns false for empty tables array', () => {
      const tables: Table[] = []

      expect(needsUpdatedByTrigger(tables)).toBe(false)
    })
  })
})

describe('ensureBetterAuthUsersTable', () => {
  describe('when users table exists with correct schema', () => {
    test('resolves successfully for TEXT id column', async () => {
      const mockTx = {
        unsafe: async (sql: string) => {
          // Check for table existence query
          if (sql.includes('SELECT EXISTS') && sql.includes("table_name = 'user'")) {
            return [{ exists: true }]
          }
          // Check for id column query
          if (sql.includes('SELECT data_type') && sql.includes("column_name = 'id'")) {
            return [{ data_type: 'text' }]
          }
          return []
        },
      }

      await expect(ensureBetterAuthUsersTable(mockTx)).resolves.toBeUndefined()
    })

    test('resolves successfully for character varying id column', async () => {
      const mockTx = {
        unsafe: async (sql: string) => {
          // Check for table existence query
          if (sql.includes('SELECT EXISTS') && sql.includes("table_name = 'user'")) {
            return [{ exists: true }]
          }
          // Check for id column query
          if (sql.includes('SELECT data_type') && sql.includes("column_name = 'id'")) {
            return [{ data_type: 'character varying' }]
          }
          return []
        },
      }

      await expect(ensureBetterAuthUsersTable(mockTx)).resolves.toBeUndefined()
    })
  })

  describe('when users table does NOT exist', () => {
    test('throws BetterAuthUsersTableRequired when table missing', async () => {
      const mockTx = {
        unsafe: async (sql: string) => {
          // Check for table existence query - return false
          if (sql.includes('SELECT EXISTS') && sql.includes("table_name = 'user'")) {
            return [{ exists: false }]
          }
          return []
        },
      }

      try {
        await ensureBetterAuthUsersTable(mockTx)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BetterAuthUsersTableRequired)
        expect((error as BetterAuthUsersTableRequired).message).toContain(
          'User fields require Better Auth users table'
        )
      }
    })
  })

  describe('when users table has incorrect schema', () => {
    test('throws when id column is missing', async () => {
      const mockTx = {
        unsafe: async (sql: string) => {
          // Check for table existence query
          if (sql.includes('SELECT EXISTS') && sql.includes("table_name = 'user'")) {
            return [{ exists: true }]
          }
          // Check for id column query - return empty array (no id column)
          if (sql.includes('SELECT data_type') && sql.includes("column_name = 'id'")) {
            return []
          }
          return []
        },
      }

      try {
        await ensureBetterAuthUsersTable(mockTx)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BetterAuthUsersTableRequired)
        expect((error as BetterAuthUsersTableRequired).message).toContain('lacks id column')
      }
    })

    test('throws when id column has incompatible type (integer)', async () => {
      const mockTx = {
        unsafe: async (sql: string) => {
          // Check for table existence query
          if (sql.includes('SELECT EXISTS') && sql.includes("table_name = 'user'")) {
            return [{ exists: true }]
          }
          // Check for id column query - return integer type
          if (sql.includes('SELECT data_type') && sql.includes("column_name = 'id'")) {
            return [{ data_type: 'integer' }]
          }
          return []
        },
      }

      try {
        await ensureBetterAuthUsersTable(mockTx)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BetterAuthUsersTableRequired)
        expect((error as BetterAuthUsersTableRequired).message).toContain(
          'incompatible id column type'
        )
        expect((error as BetterAuthUsersTableRequired).message).toContain('integer')
      }
    })

    test('throws when id column has incompatible type (uuid)', async () => {
      const mockTx = {
        unsafe: async (sql: string) => {
          // Check for table existence query
          if (sql.includes('SELECT EXISTS') && sql.includes("table_name = 'user'")) {
            return [{ exists: true }]
          }
          // Check for id column query - return uuid type
          if (sql.includes('SELECT data_type') && sql.includes("column_name = 'id'")) {
            return [{ data_type: 'uuid' }]
          }
          return []
        },
      }

      try {
        await ensureBetterAuthUsersTable(mockTx)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(BetterAuthUsersTableRequired)
        expect((error as BetterAuthUsersTableRequired).message).toContain(
          'incompatible id column type'
        )
        expect((error as BetterAuthUsersTableRequired).message).toContain('uuid')
      }
    })
  })
})

describe('ensureUpdatedByTriggerFunction', () => {
  test('creates trigger function successfully', async () => {
    let executedSQL = ''
    const mockTx = {
      unsafe: async (sql: string) => {
        executedSQL = sql
        return []
      },
    }

    await ensureUpdatedByTriggerFunction(mockTx)

    expect(executedSQL).toContain('CREATE OR REPLACE FUNCTION set_updated_by()')
    expect(executedSQL).toContain('RETURNS TRIGGER')
    expect(executedSQL).toContain('RETURN NEW')
    expect(executedSQL).toContain('plpgsql')
  })

  test('replaces existing trigger function', async () => {
    const mockTx = {
      unsafe: async (sql: string) => {
        // Simulate function already exists - should use CREATE OR REPLACE
        expect(sql).toContain('CREATE OR REPLACE')
        return []
      },
    }

    await expect(ensureUpdatedByTriggerFunction(mockTx)).resolves.toBeUndefined()
  })
})
