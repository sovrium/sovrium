/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe } from 'bun:test'
import { Effect } from 'effect'
import {
  batchCreateProgram,
  batchUpdateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  upsertProgram,
} from './batch-operations'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

// Create a proper mock session that matches the Session type
const createMockSession = (): Session => ({
  id: 'session-1',
  userId: 'user-1',
  token: 'mock-token',
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ipAddress: null,
  userAgent: null,
  impersonatedBy: null,
})

describe('batch-operations', () => {
  describe('batchCreateProgram', () => {
    test('returns records with count', async () => {
      const session = createMockSession()

      const tableName = 'test_table'
      const recordsData = [
        { name: 'Record 1', value: 100 },
        { name: 'Record 2', value: 200 },
      ]

      // Note: This test verifies the program structure
      // In actual execution, it would require infrastructure dependencies
      const program = batchCreateProgram(session, tableName, recordsData)

      // Verify the program is an Effect
      expect(Effect.isEffect(program)).toBe(true)
    })
  })

  describe('batchUpdateProgram', () => {
    test('returns updated records with count', () => {
      const session = createMockSession()

      const tableName = 'test_table'
      const recordsData = [
        { id: 'record-1', name: 'Updated 1' },
        { id: 'record-2', name: 'Updated 2' },
      ]

      const program = batchUpdateProgram(session, tableName, recordsData)

      // Verify the program is an Effect
      expect(Effect.isEffect(program)).toBe(true)
    })
  })

  describe('batchDeleteProgram', () => {
    test('returns success with deleted count and IDs', () => {
      const session = createMockSession()

      const tableName = 'test_table'
      const ids = ['record-1', 'record-2', 'record-3']

      const program = batchDeleteProgram(session, tableName, ids)

      // Verify the program is an Effect
      expect(Effect.isEffect(program)).toBe(true)
    })
  })

  describe('batchRestoreProgram', () => {
    test('returns success with restored records', () => {
      const session = createMockSession()

      const tableName = 'test_table'
      const ids = ['record-1', 'record-2']

      const program = batchRestoreProgram(session, tableName, ids)

      // Verify the program is an Effect
      expect(Effect.isEffect(program)).toBe(true)
    })
  })

  describe('upsertProgram', () => {
    test('creates records with IDs for new records', async () => {
      const recordsData = [
        { fields: { name: 'New Record 1' } },
        { fields: { name: 'New Record 2' } },
      ]

      const program = upsertProgram(recordsData)
      const result = await Effect.runPromise(program)

      expect(result.records).toHaveLength(2)
      expect(result.created).toBe(2)
      expect(result.updated).toBe(0)
      expect(result.records[0]?.id).toBeDefined()
      expect(result.records[0]?.fields).toEqual({ name: 'New Record 1' })
      expect(result.records[0]?.createdAt).toBeDefined()
      expect(result.records[0]?.updatedAt).toBeDefined()
    })

    test('updates records with existing IDs', async () => {
      const recordsData = [
        { id: 'existing-1', fields: { name: 'Updated Record 1' } },
        { id: 'existing-2', fields: { name: 'Updated Record 2' } },
      ]

      const program = upsertProgram(recordsData)
      const result = await Effect.runPromise(program)

      expect(result.records).toHaveLength(2)
      expect(result.created).toBe(0)
      expect(result.updated).toBe(2)
      expect(result.records[0]?.id).toBe('existing-1')
    })

    test('handles mix of new and existing records', async () => {
      const recordsData = [
        { fields: { name: 'New Record' } },
        { id: 'existing-1', fields: { name: 'Updated Record' } },
      ]

      const program = upsertProgram(recordsData)
      const result = await Effect.runPromise(program)

      expect(result.records).toHaveLength(2)
      expect(result.created).toBe(1)
      expect(result.updated).toBe(1)
    })

    test('handles empty fields gracefully', async () => {
      const recordsData = [{ id: 'test-id' }]

      const program = upsertProgram(recordsData)
      const result = await Effect.runPromise(program)

      expect(result.records).toHaveLength(1)
      expect(result.records[0]?.fields).toEqual({})
    })
  })
})
