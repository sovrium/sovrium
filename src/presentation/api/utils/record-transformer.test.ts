/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { transformRecord, transformRecords } from './record-transformer'

describe('transformRecord', () => {
  describe('When transforming a complete record', () => {
    test('Then converts id to string', () => {
      const record = { id: 123, name: 'Test' }
      const result = transformRecord(record)
      expect(result.id).toBe('123')
    })

    test('Then preserves created_at as string', () => {
      const timestamp = '2025-01-15T10:30:00.000Z'
      const record = { id: 1, created_at: timestamp }
      const result = transformRecord(record)
      expect(result.createdAt).toBe(timestamp)
    })

    test('Then preserves updated_at as string', () => {
      const timestamp = '2025-01-15T10:30:00.000Z'
      const record = { id: 1, updated_at: timestamp }
      const result = transformRecord(record)
      expect(result.updatedAt).toBe(timestamp)
    })

    test('Then includes all fields in fields property', () => {
      const record = { id: 1, name: 'Test', email: 'test@example.com', active: true }
      const result = transformRecord(record)
      expect(result.fields).toEqual(record)
    })
  })

  describe('When transforming a record with missing timestamps', () => {
    test('Then provides default createdAt when created_at is missing', () => {
      const record = { id: 1, name: 'Test' }
      const result = transformRecord(record)
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    test('Then provides default updatedAt when updated_at is missing', () => {
      const record = { id: 1, name: 'Test' }
      const result = transformRecord(record)
      expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })

  describe('When transforming records with various id types', () => {
    test('Then handles numeric id', () => {
      const record = { id: 42 }
      expect(transformRecord(record).id).toBe('42')
    })

    test('Then handles string id', () => {
      const record = { id: 'uuid-123' }
      expect(transformRecord(record).id).toBe('uuid-123')
    })

    test('Then handles UUID id', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const record = { id: uuid }
      expect(transformRecord(record).id).toBe(uuid)
    })
  })
})

describe('transformRecords', () => {
  describe('When transforming multiple records', () => {
    test('Then transforms each record', () => {
      const records = [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' },
        { id: 3, name: 'Third' },
      ]
      const result = transformRecords(records)

      expect(result.length).toBe(3)
      expect(result[0]?.id).toBe('1')
      expect(result[1]?.id).toBe('2')
      expect(result[2]?.id).toBe('3')
    })

    test('Then returns empty array for empty input', () => {
      const result = transformRecords([])
      expect(result).toEqual([])
    })

    test('Then preserves readonly nature of result', () => {
      const records = [{ id: 1, name: 'Test' }]
      const result = transformRecords(records)
      // Result should be readonly array
      expect(Array.isArray(result)).toBe(true)
    })
  })
})
