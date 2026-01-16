/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import {
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
} from './programs'
import type { App } from '@/domain/models/app'

// Mock app factory moved to outer scope
const createMockApp = (): App => ({
  name: 'Test App',
  tables: [
    {
      id: 1,
      name: 'users',
      fields: [
        { id: 1, name: 'id', type: 'uuid', required: true, unique: true, indexed: false },
        { id: 2, name: 'email', type: 'text', required: true, unique: true, indexed: false },
        { id: 3, name: 'name', type: 'text', required: true, unique: false, indexed: false },
      ],
      primaryKey: { type: 'auto-increment', field: 'id' },
      permissions: {
        read: { type: 'roles', roles: ['admin', 'member'] },
        create: { type: 'roles', roles: ['admin'] },
        update: { type: 'roles', roles: ['admin'] },
        delete: { type: 'roles', roles: ['admin'] },
        fields: [{ field: 'email', read: { type: 'authenticated' }, write: undefined }],
      },
    },
    {
      id: 2,
      name: 'posts',
      fields: [
        { id: 1, name: 'id', type: 'uuid', required: true, unique: true, indexed: false },
        { id: 2, name: 'title', type: 'text', required: true, unique: false, indexed: false },
      ],
      primaryKey: { type: 'auto-increment', field: 'id' },
      permissions: {
        read: { type: 'roles', roles: ['owner'] },
      },
    },
  ],
})

describe('programs', () => {
  describe('createListTablesProgram', () => {
    test('should list tables for admin role', async () => {
      const app = createMockApp()
      const program = createListTablesProgram('admin', app)

      const result = await Effect.runPromise(program)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: '1',
        name: 'users',
      })
    })

    test('should list tables for member role', async () => {
      const app = createMockApp()
      const program = createListTablesProgram('member', app)

      const result = await Effect.runPromise(program)

      expect(result).toHaveLength(1)
      expect((result[0] as { name: string })?.name).toBe('users')
    })

    test('should deny list for viewer role', async () => {
      const app = createMockApp()
      const program = createListTablesProgram('viewer', app)

      const result = await Effect.runPromise(program.pipe(Effect.either))
      expect(result._tag).toBe('Left')
    })

    test('should filter tables based on read permissions', async () => {
      const app = createMockApp()
      const program = createListTablesProgram('member', app)

      const result = await Effect.runPromise(program)

      // Member can only see users table, not posts (requires owner role)
      expect(result).toHaveLength(1)
      expect((result[0] as { name: string })?.name).toBe('users')
    })

    test('should return empty array when no tables have read permissions', async () => {
      const appNoPerms: App = {
        name: 'Test App',
        tables: [
          {
            id: 1,
            name: 'private',
            fields: [],
            primaryKey: { type: 'auto-increment', field: 'id' },
            permissions: undefined, // No permissions = deny by default
          },
        ],
      }

      const program = createListTablesProgram('member', appNoPerms)
      const result = await Effect.runPromise(program)

      expect(result).toHaveLength(0)
    })
  })

  describe('createGetTableProgram', () => {
    test('should return table details for authorized user', async () => {
      const app = createMockApp()
      const program = createGetTableProgram('users', app, 'admin')

      const result = await Effect.runPromise(program)

      expect(result.table.name).toBe('users')
      expect(result.table.fields).toHaveLength(3)
      expect(result.table.primaryKey).toBe('id')
    })

    test('should find table by ID', async () => {
      const app = createMockApp()
      const program = createGetTableProgram('1', app, 'admin')

      const result = await Effect.runPromise(program)

      expect(result.table.name).toBe('users')
    })

    test('should throw TableNotFoundError for non-existent table', async () => {
      const app = createMockApp()
      const program = createGetTableProgram('nonexistent', app, 'admin')

      const result = await Effect.runPromise(program.pipe(Effect.either))
      expect(result._tag).toBe('Left')
    })

    test('should deny access when read permission not granted', async () => {
      const app = createMockApp()
      const program = createGetTableProgram('posts', app, 'member')

      const result = await Effect.runPromise(program.pipe(Effect.either))
      expect(result._tag).toBe('Left')
    })

    test('should deny access when no read permission defined', async () => {
      const appNoPerms: App = {
        name: 'Test App',
        tables: [
          {
            id: 1,
            name: 'private',
            fields: [],
            primaryKey: { type: 'auto-increment', field: 'id' },
            permissions: undefined,
          },
        ],
      }

      const program = createGetTableProgram('private', appNoPerms, 'member')

      const result = await Effect.runPromise(program.pipe(Effect.either))
      expect(result._tag).toBe('Left')
    })
  })

  describe('createGetPermissionsProgram', () => {
    test('should return full permissions for admin role', async () => {
      const app = createMockApp()
      const program = createGetPermissionsProgram('users', app, 'admin')

      const result = await Effect.runPromise(program)

      expect(result.table.read).toBe(true)
      expect(result.table.create).toBe(true)
      expect(result.table.update).toBe(true)
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- Accessing property, not Drizzle delete operation
      expect(result.table.delete).toBe(true)
      expect(result.fields.email?.read).toBe(true)
      expect(result.fields.email?.write).toBe(true)
    })

    test('should return limited permissions for member role', async () => {
      const app = createMockApp()
      const program = createGetPermissionsProgram('users', app, 'member')

      const result = await Effect.runPromise(program)

      expect(result.table.read).toBe(true)
      expect(result.table.create).toBe(false)
      expect(result.table.update).toBe(false)
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- Accessing property, not Drizzle delete operation
      expect(result.table.delete).toBe(false)
      expect(result.fields.email?.read).toBe(true)
      expect(result.fields.email?.write).toBe(false)
    })

    test('should throw TableNotFoundError for non-existent table', async () => {
      const app = createMockApp()
      const program = createGetPermissionsProgram('nonexistent', app, 'member')

      const result = await Effect.runPromise(program.pipe(Effect.either))
      expect(result._tag).toBe('Left')
    })

    test('should return permissions for table found by ID', async () => {
      const app = createMockApp()
      const program = createGetPermissionsProgram('1', app, 'admin')

      const result = await Effect.runPromise(program)

      expect(result.table.read).toBe(true)
    })
  })
})
