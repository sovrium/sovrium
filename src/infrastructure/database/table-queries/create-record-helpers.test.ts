/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { buildInsertClauses, executeInsert } from './create-record-helpers'

// Clear all mocks before each test to prevent pollution from crud.test.ts
// which has module-level mocks that can persist across test files
beforeEach(() => {
  mock.restore()
})

// Helper to create fresh SQL clauses for each test
const createClauses = () => ({
  columnsClause: sql.raw('name, email'),
  valuesClause: sql.raw("'John', 'john@example.com'"),
})

describe('buildInsertClauses', () => {
  test('builds columns and values for fields', () => {
    const fields = {
      name: 'Test User',
      email: 'test@example.com',
    }

    const result = buildInsertClauses(fields)

    expect(result.columnsClause).toBeDefined()
    expect(result.valuesClause).toBeDefined()
    expect(typeof result.columnsClause).toBe('object')
    expect(typeof result.valuesClause).toBe('object')
  })

  test('handles single field', () => {
    const result = buildInsertClauses({ name: 'Test' })

    expect(result.columnsClause).toBeDefined()
    expect(result.valuesClause).toBeDefined()
  })

  describe('SQL injection prevention', () => {
    test('validates column names and throws on invalid characters', () => {
      const validFields = { valid_field: 'value1' }
      expect(() => buildInsertClauses(validFields)).not.toThrow()

      const invalidFields = { 'email; DROP TABLE users;--': 'malicious' }
      expect(() => buildInsertClauses(invalidFields)).toThrow('Invalid column name')
    })
  })
})

describe('executeInsert', () => {
  test('returns created record on success', async () => {
    const { columnsClause, valuesClause } = createClauses()
    const mockTx = {
      execute: async () => [
        {
          id: 1,
          name: 'John',
          email: 'john@example.com',
          created_at: new Date(),
        },
      ],
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id', 1)
    expect(result).toHaveProperty('name', 'John')
    expect(result).toHaveProperty('email', 'john@example.com')
  })

  test('returns empty object when no result', async () => {
    const { columnsClause, valuesClause } = createClauses()
    const mockTx = {
      execute: async () => [],
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const result = await Effect.runPromise(program)

    expect(result).toEqual({})
  })

  test('throws UniqueConstraintViolationError on unique constraint violation (code 23505)', async () => {
    const { columnsClause, valuesClause } = createClauses()
    const mockTx = {
      execute: async () => {
        const error: any = new Error('Unique violation')
        error.cause = { code: '23505', constraint: 'users_email_unique' }
        throw error
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      // Effect wraps errors, check the message
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('Unique constraint violation')
    }
  })

  test('throws UniqueConstraintViolationError when error has constraint property', async () => {
    const { columnsClause, valuesClause } = createClauses()
    const mockTx = {
      execute: async () => {
        const error: any = new Error('Constraint violation')
        error.cause = { constraint: 'users_email_key' }
        throw error
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      // Effect wraps errors, check the message
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('Unique constraint violation')
    }
  })

  test('throws UniqueConstraintViolationError when error message mentions unique constraint', async () => {
    const { columnsClause, valuesClause } = createClauses()
    const mockTx = {
      execute: async () => {
        const error: any = new Error('Database error')
        error.cause = { message: 'duplicate key value violates unique constraint' }
        throw error
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      // Effect wraps errors, check the message
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('Unique constraint violation')
    }
  })

  test('throws SessionContextError on other database errors', async () => {
    const { columnsClause, valuesClause } = createClauses()
    const mockTx = {
      execute: async () => {
        throw new Error('Connection timeout')
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      // Effect wraps errors, check the message
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('Failed to create record in users')
    }
  })

  test('includes table name in SessionContextError message', async () => {
    const { columnsClause, valuesClause } = createClauses()
    const mockTx = {
      execute: async () => {
        throw new Error('Generic database error')
      },
    }

    const program = executeInsert('custom_table', columnsClause, valuesClause, mockTx as any)

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      // Effect wraps errors, check the message
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('custom_table')
    }
  })
})
