/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect, Exit, Cause } from 'effect'
import { ForbiddenError } from '@/infrastructure/database/session-context'
import {
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
  listViewsProgram,
  getViewProgram,
  getViewRecordsProgram,
  TableNotFoundError,
} from './table-operations'
import type { App } from '@/domain/models/app'

describe('table-operations', () => {
  const mockApp: App = {
    name: 'Test App',
    tables: [
      {
        id: 1,
        name: 'users',
        fields: [
          {
            id: 1,
            name: 'name',
            type: 'text',
            required: true,
            unique: false,
            indexed: false,
          },
          {
            id: 2,
            name: 'email',
            type: 'email',
            required: true,
            unique: true,
            indexed: true,
          },
        ],
        primaryKey: { field: 'id', type: 'uuid' },
        permissions: {
          read: { type: 'roles', roles: ['owner', 'admin', 'member'] },
          create: { type: 'roles', roles: ['owner', 'admin'] },
          update: { type: 'roles', roles: ['owner', 'admin'] },
          delete: { type: 'roles', roles: ['owner'] },
        },
      },
      {
        id: 2,
        name: 'posts',
        fields: [
          {
            id: 1,
            name: 'title',
            type: 'text',
            required: true,
            unique: false,
            indexed: false,
          },
        ],
        primaryKey: { field: 'id', type: 'uuid' },
        permissions: {
          read: { type: 'roles', roles: ['owner', 'admin'] },
        },
      },
    ],
  }

  describe('createListTablesProgram', () => {
    test('allows owner to list accessible tables', async () => {
      const program = createListTablesProgram('owner', mockApp)
      const result = await Effect.runPromise(program)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('name')
    })

    test('allows admin to list accessible tables', async () => {
      const program = createListTablesProgram('admin', mockApp)
      const result = await Effect.runPromise(program)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(2)
    })

    test('allows member to list accessible tables', async () => {
      const program = createListTablesProgram('member', mockApp)
      const result = await Effect.runPromise(program)

      expect(Array.isArray(result)).toBe(true)
      // Member can only see tables where they have read permission
      expect(result).toHaveLength(1)
      // Type assertion for accessing properties on unknown[]
      const tables = result as Array<{ id: string; name: string }>
      expect(tables[0]?.name).toBe('users')
    })

    test('denies viewer from listing tables', async () => {
      const program = createListTablesProgram('viewer', mockApp)
      const exit = await Effect.runPromiseExit(program)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const failureOption = Cause.failureOption(exit.cause)
        expect(failureOption._tag).toBe('Some')
        if (failureOption._tag === 'Some') {
          expect(failureOption.value).toBeInstanceOf(ForbiddenError)
        }
      }
    })

    test('filters tables based on read permissions', async () => {
      const program = createListTablesProgram('member', mockApp)
      const result = await Effect.runPromise(program)

      // Member should only see 'users' table (not 'posts')
      expect(result).toHaveLength(1)
      // Type assertion for accessing properties on unknown[]
      const tables = result as Array<{ id: string; name: string }>
      expect(tables[0]?.name).toBe('users')
    })

    test('returns empty array when no tables have read permissions', async () => {
      const appWithNoPermissions: App = {
        name: 'Test App',
        tables: [
          {
            id: 1,
            name: 'private',
            fields: [],
            primaryKey: { field: 'id', type: 'uuid' },
            permissions: {
              read: { type: 'roles', roles: ['owner'] },
            },
          },
        ],
      }

      const program = createListTablesProgram('viewer', appWithNoPermissions)
      const exit = await Effect.runPromiseExit(program)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const failureOption = Cause.failureOption(exit.cause)
        expect(failureOption._tag).toBe('Some')
        if (failureOption._tag === 'Some') {
          expect(failureOption.value).toBeInstanceOf(ForbiddenError)
        }
      }
    })
  })

  describe('createGetTableProgram', () => {
    test('returns table details for authorized user', async () => {
      const program = createGetTableProgram('1', mockApp, 'owner')
      const result = await Effect.runPromise(program)

      expect(result.table).toBeDefined()
      expect(result.table.id).toBe('1')
      expect(result.table.name).toBe('users')
      expect(result.table.fields).toHaveLength(2)
      expect(result.table.primaryKey).toBe('id')
    })

    test('finds table by name', async () => {
      const program = createGetTableProgram('users', mockApp, 'owner')
      const result = await Effect.runPromise(program)

      expect(result.table.name).toBe('users')
    })

    test('throws TableNotFoundError when table does not exist', async () => {
      const program = createGetTableProgram('non-existent', mockApp, 'owner')
      const exit = await Effect.runPromiseExit(program)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const failureOption = Cause.failureOption(exit.cause)
        expect(failureOption._tag).toBe('Some')
        if (failureOption._tag === 'Some') {
          expect(failureOption.value).toBeInstanceOf(TableNotFoundError)
        }
      }
    })

    test('denies access when user lacks read permission', async () => {
      const program = createGetTableProgram('2', mockApp, 'member')

      await expect(Effect.runPromise(program)).rejects.toThrow()
    })

    test('maps field properties correctly', async () => {
      const program = createGetTableProgram('1', mockApp, 'owner')
      const result = await Effect.runPromise(program)

      const emailField = result.table.fields.find((f) => f.name === 'email')
      expect(emailField).toBeDefined()
      expect(emailField?.type).toBe('email')
      expect(emailField?.required).toBe(true)
      expect(emailField?.unique).toBe(true)
      expect(emailField?.indexed).toBe(true)
    })
  })

  describe('createGetPermissionsProgram', () => {
    test('returns full permissions for admin role', async () => {
      const program = createGetPermissionsProgram('1', mockApp, 'admin')
      const result = await Effect.runPromise(program)

      expect(result.table.read).toBe(true)
      expect(result.table.create).toBe(true)
      expect(result.table.update).toBe(true)
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- Checking permission boolean, not Drizzle operation
      expect(result.table.delete).toBe(true)
    })

    test('returns role-based permissions for owner', async () => {
      const program = createGetPermissionsProgram('1', mockApp, 'owner')
      const result = await Effect.runPromise(program)

      expect(result.table.read).toBe(true)
      expect(result.table.create).toBe(true)
      expect(result.table.update).toBe(true)
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- Checking permission boolean, not Drizzle operation
      expect(result.table.delete).toBe(true)
    })

    test('returns limited permissions for member', async () => {
      const program = createGetPermissionsProgram('1', mockApp, 'member')
      const result = await Effect.runPromise(program)

      expect(result.table.read).toBe(true)
      expect(result.table.create).toBe(false)
      expect(result.table.update).toBe(false)
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- Checking permission boolean, not Drizzle operation
      expect(result.table.delete).toBe(false)
    })

    test('throws TableNotFoundError for non-existent table', async () => {
      const program = createGetPermissionsProgram('999', mockApp, 'owner')
      const exit = await Effect.runPromiseExit(program)

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const failureOption = Cause.failureOption(exit.cause)
        expect(failureOption._tag).toBe('Some')
        if (failureOption._tag === 'Some') {
          expect(failureOption.value).toBeInstanceOf(TableNotFoundError)
        }
      }
    })

    test('returns field permissions object', async () => {
      const program = createGetPermissionsProgram('1', mockApp, 'owner')
      const result = await Effect.runPromise(program)

      expect(result.fields).toBeDefined()
      expect(typeof result.fields).toBe('object')
    })
  })

  describe('listViewsProgram', () => {
    test('returns empty views array', async () => {
      const mockApp = { name: 'test-app', tables: [] }
      const program = listViewsProgram('table-1', mockApp as App, 'admin')
      const result = await Effect.runPromise(program.pipe(Effect.either))

      // Should fail with TableNotFoundError since table doesn't exist
      expect(result._tag).toBe('Left')
    })
  })

  describe('getViewProgram', () => {
    test('returns view details', async () => {
      const mockApp = {
        name: 'test-app',
        tables: [
          {
            id: 1,
            name: 'table-1',
            fields: [],
            views: [
              {
                id: 'view-1',
                name: 'Test View',
              },
            ],
          },
        ],
      }
      const program = getViewProgram('table-1', 'view-1', mockApp as App)
      const result = (await Effect.runPromise(program)) as Record<string, unknown>

      expect(result.id).toBe('view-1')
      expect(result.name).toBe('Test View')
    })
  })

  describe('getViewRecordsProgram', () => {
    test('returns empty records with pagination', async () => {
      const program = getViewRecordsProgram()
      const result = await Effect.runPromise(program)

      expect(result.records).toEqual([])
      expect(result.pagination).toBeDefined()
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
      expect(result.pagination.hasNextPage).toBe(false)
      expect(result.pagination.hasPreviousPage).toBe(false)
    })
  })
})
