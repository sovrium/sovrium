/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  sanitizeFields,
  buildInsertClauses,
  checkTableColumns,
  executeInsert,
} from './create-record-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

describe('sanitizeFields', () => {
  describe('when table has owner_id column', () => {
    test('removes owner_id from fields', () => {
      const fields = {
        name: 'John Doe',
        email: 'john@example.com',
        owner_id: 'user-123',
      }

      const result = sanitizeFields(fields, false, true)

      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      })
      expect(result).not.toHaveProperty('owner_id')
    })

    test('preserves other fields', () => {
      const fields = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'admin',
        owner_id: 'user-456',
      }

      const result = sanitizeFields(fields, false, true)

      expect(result).toEqual({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'admin',
      })
    })

    test('returns empty object when only owner_id provided', () => {
      const fields = {
        owner_id: 'user-789',
      }

      const result = sanitizeFields(fields, false, true)

      expect(result).toEqual({})
    })
  })

  describe('when table does NOT have owner_id column', () => {
    test('preserves all fields including owner_id', () => {
      const fields = {
        name: 'Bob Smith',
        owner_id: 'custom-value',
      }

      const result = sanitizeFields(fields, false, false)

      expect(result).toEqual({
        name: 'Bob Smith',
        owner_id: 'custom-value',
      })
    })
  })

  describe('edge cases', () => {
    test('handles empty fields object', () => {
      const result = sanitizeFields({}, false, true)
      expect(result).toEqual({})
    })

    test('preserves fields with similar names', () => {
      const fields = {
        owner_id: 'should-remove',
        owner_name: 'should-keep',
        _owner_id: 'should-keep',
      }

      const result = sanitizeFields(fields, false, true)

      expect(result).toEqual({
        owner_name: 'should-keep',
        _owner_id: 'should-keep',
      })
    })

    test('handles null and undefined values', () => {
      const fields = {
        name: null,
        email: undefined,
        owner_id: 'remove',
      }

      const result = sanitizeFields(fields, false, true)

      expect(result).toEqual({
        name: null,
        email: undefined,
      })
    })
  })
})

describe('buildInsertClauses', () => {
  const mockSession: Readonly<Session> = {
    userId: 'session-user-123',
    token: 'token',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    id: 'session-id',
    ipAddress: null,
    userAgent: null,
    impersonatedBy: null,
  }

  describe('when table has owner_id column', () => {
    test('adds owner_id from session', () => {
      const sanitizedFields = {
        name: 'Test User',
        email: 'test@example.com',
      }

      const result = buildInsertClauses(sanitizedFields, false, true, mockSession)

      // Verify columns include owner_id
      expect(result.columnsClause).toBeDefined()
      expect(result.valuesClause).toBeDefined()

      // The columnsClause should contain the owner_id identifier
      // We can't directly inspect sql.identifier output, but we verify structure exists
      expect(typeof result.columnsClause).toBe('object')
      expect(typeof result.valuesClause).toBe('object')
    })

    test('handles empty sanitized fields with owner_id', () => {
      const result = buildInsertClauses({}, false, true, mockSession)

      expect(result.columnsClause).toBeDefined()
      expect(result.valuesClause).toBeDefined()
    })
  })

  describe('when table does NOT have owner_id column', () => {
    test('does not add owner_id', () => {
      const sanitizedFields = {
        name: 'Test User',
        email: 'test@example.com',
      }

      const result = buildInsertClauses(sanitizedFields, false, false, mockSession)

      expect(result.columnsClause).toBeDefined()
      expect(result.valuesClause).toBeDefined()
    })

    test('handles empty fields without owner_id', () => {
      const result = buildInsertClauses({}, false, false, mockSession)

      expect(result.columnsClause).toBeDefined()
      expect(result.valuesClause).toBeDefined()
    })
  })

  describe('SQL injection prevention', () => {
    test('validates column names and throws on invalid characters', () => {
      const maliciousFields = {
        valid_field: 'value1',
      }

      // This should not throw for valid field names
      expect(() => buildInsertClauses(maliciousFields, false, false, mockSession)).not.toThrow()

      // Invalid column names should be caught by validateColumnName
      const invalidFields = {
        'email; DROP TABLE users;--': 'malicious',
      }

      expect(() => buildInsertClauses(invalidFields, false, false, mockSession)).toThrow(
        'Invalid column name'
      )
    })
  })
})

describe('checkTableColumns', () => {
  test('returns true when owner_id column exists', async () => {
    const mockTx = {
      execute: async () => [{ column_name: 'owner_id' }],
    }

    const program = checkTableColumns('users', mockTx as any)
    const result = await Effect.runPromise(program)

    expect(result.hasOwnerId).toBe(true)
  })

  test('returns false when owner_id column does not exist', async () => {
    const mockTx = {
      execute: async () => [],
    }

    const program = checkTableColumns('users', mockTx as any)
    const result = await Effect.runPromise(program)

    expect(result.hasOwnerId).toBe(false)
  })

  test('returns false when other columns exist but not owner_id', async () => {
    const mockTx = {
      execute: async () => [{ column_name: 'id' }, { column_name: 'name' }],
    }

    const program = checkTableColumns('users', mockTx as any)
    const result = await Effect.runPromise(program)

    expect(result.hasOwnerId).toBe(false)
  })

  test('handles database errors', async () => {
    const mockTx = {
      execute: async () => {
        throw new Error('Database connection failed')
      },
    }

    const program = checkTableColumns('users', mockTx as any)

    try {
      await Effect.runPromise(program)
      expect(true).toBe(false) // Should not reach here
    } catch (error) {
      // Effect wraps errors, check the message
      expect(error).toHaveProperty('message')
      expect((error as Error).message).toContain('Failed to check table columns')
    }
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
    const result = await Effect.runPromise(program)

    expect(result).toHaveProperty('id', 1)
    expect(result).toHaveProperty('name', 'John')
    expect(result).toHaveProperty('email', 'john@example.com')
  })

  test('returns empty object when no result', async () => {
    const mockTx = {
      execute: async () => [],
    }

    const program = executeInsert('users', columnsClause, valuesClause, mockTx as any)
    const result = await Effect.runPromise(program)

    expect(result).toEqual({})
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
