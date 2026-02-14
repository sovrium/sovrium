/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test'
import { sql } from 'drizzle-orm'
import { Effect, Exit, Cause } from 'effect'
import { buildInsertClauses, executeInsert } from './create-record-helpers'

// Prevent mock pollution from crud.test.ts which mocks this module
// This file tests the REAL implementation, not mocks
beforeAll(() => {
  mock.restore()
})

afterAll(() => {
  mock.restore()
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
  const columnsClause = sql.raw('name, email')
  const valuesClause = sql.raw("'John', 'john@example.com'")

  test('returns created record on success', async () => {
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
    const exit = await Effect.runPromiseExit(program)

    if (exit._tag === 'Success') {
      expect(exit.value).toHaveProperty('id', 1)
      expect(exit.value).toHaveProperty('name', 'John')
      expect(exit.value).toHaveProperty('email', 'john@example.com')
    } else {
      throw new Error('Expected success but got failure')
    }
  })

  test('returns empty object when no result', async () => {
    const mockTx = {
      execute: async () => [],
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const exit = await Effect.runPromiseExit(program)

    if (exit._tag === 'Success') {
      expect(exit.value).toEqual({})
    } else {
      throw new Error('Expected success but got failure')
    }
  })

  test('throws UniqueConstraintViolationError on unique constraint violation (code 23505)', async () => {
    const mockTx = {
      execute: async () => {
        const error: any = new Error('Unique violation')
        error.cause = { code: '23505', constraint: 'users_email_unique' }
        throw error
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const exit = await Effect.runPromiseExit(program)

    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause) as Error
      expect(error).toHaveProperty('message')
      expect(error.message).toContain('Unique constraint violation')
    } else {
      throw new Error('Expected failure but got success')
    }
  })

  test('throws UniqueConstraintViolationError when error has constraint property', async () => {
    const mockTx = {
      execute: async () => {
        const error: any = new Error('Constraint violation')
        error.cause = { constraint: 'users_email_key' }
        throw error
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const exit = await Effect.runPromiseExit(program)

    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause) as Error
      expect(error).toHaveProperty('message')
      expect(error.message).toContain('Unique constraint violation')
    } else {
      throw new Error('Expected failure but got success')
    }
  })

  test('throws UniqueConstraintViolationError when error message mentions unique constraint', async () => {
    const mockTx = {
      execute: async () => {
        const error: any = new Error('Database error')
        error.cause = { message: 'duplicate key value violates unique constraint' }
        throw error
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const exit = await Effect.runPromiseExit(program)

    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause) as Error
      expect(error).toHaveProperty('message')
      expect(error.message).toContain('Unique constraint violation')
    } else {
      throw new Error('Expected failure but got success')
    }
  })

  test('throws SessionContextError on other database errors', async () => {
    const mockTx = {
      execute: async () => {
        throw new Error('Connection timeout')
      },
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const exit = await Effect.runPromiseExit(program)

    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause) as Error
      expect(error).toHaveProperty('message')
      expect(error.message).toContain('Failed to create record in users')
    } else {
      throw new Error('Expected failure but got success')
    }
  })

  test('includes table name in SessionContextError message', async () => {
    const mockTx = {
      execute: async () => {
        throw new Error('Generic database error')
      },
    }

    const program = executeInsert('custom_table', columnsClause, valuesClause, mockTx as any)
    const exit = await Effect.runPromiseExit(program)

    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause) as Error
      expect(error).toHaveProperty('message')
      expect(error.message).toContain('custom_table')
    } else {
      throw new Error('Expected failure but got success')
    }
  })
})
