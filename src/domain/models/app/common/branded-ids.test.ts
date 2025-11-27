/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  TableIdSchema,
  FieldIdSchema,
  RecordIdSchema,
  UserIdSchema,
  OrganizationIdSchema,
  WorkspaceIdSchema,
  BlockIdSchema,
  BrandedViewIdSchema,
} from './branded-ids'

describe('Branded IDs', () => {
  describe('TableIdSchema', () => {
    test('should accept valid table ID', () => {
      const result = Schema.decodeUnknownSync(TableIdSchema)(1)
      expect(result as number).toBe(1)
    })

    test('should accept large table ID', () => {
      const result = Schema.decodeUnknownSync(TableIdSchema)(1000)
      expect(result as number).toBe(1000)
    })

    test('should reject zero', () => {
      expect(() => Schema.decodeUnknownSync(TableIdSchema)(0)).toThrow()
    })

    test('should reject negative numbers', () => {
      expect(() => Schema.decodeUnknownSync(TableIdSchema)(-1)).toThrow()
    })

    test('should reject non-integers', () => {
      expect(() => Schema.decodeUnknownSync(TableIdSchema)(1.5)).toThrow()
    })
  })

  describe('FieldIdSchema', () => {
    test('should accept valid field ID', () => {
      const result = Schema.decodeUnknownSync(FieldIdSchema)(1)
      expect(result as number).toBe(1)
    })

    test('should reject zero', () => {
      expect(() => Schema.decodeUnknownSync(FieldIdSchema)(0)).toThrow()
    })
  })

  describe('RecordIdSchema', () => {
    test('should accept valid record ID', () => {
      const result = Schema.decodeUnknownSync(RecordIdSchema)(1)
      expect(result as number).toBe(1)
    })

    test('should reject zero', () => {
      expect(() => Schema.decodeUnknownSync(RecordIdSchema)(0)).toThrow()
    })
  })

  describe('UserIdSchema', () => {
    test('should accept valid user ID', () => {
      const result = Schema.decodeUnknownSync(UserIdSchema)('usr_123abc')
      expect(result as string).toBe('usr_123abc')
    })

    test('should accept UUID format', () => {
      const result = Schema.decodeUnknownSync(UserIdSchema)('550e8400-e29b-41d4-a716-446655440000')
      expect(result as string).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    test('should reject empty string', () => {
      expect(() => Schema.decodeUnknownSync(UserIdSchema)('')).toThrow()
    })
  })

  describe('OrganizationIdSchema', () => {
    test('should accept valid organization ID', () => {
      const result = Schema.decodeUnknownSync(OrganizationIdSchema)('org_acme')
      expect(result as string).toBe('org_acme')
    })

    test('should reject empty string', () => {
      expect(() => Schema.decodeUnknownSync(OrganizationIdSchema)('')).toThrow()
    })
  })

  describe('WorkspaceIdSchema', () => {
    test('should accept valid workspace ID', () => {
      const result = Schema.decodeUnknownSync(WorkspaceIdSchema)('ws_marketing')
      expect(result as string).toBe('ws_marketing')
    })

    test('should reject empty string', () => {
      expect(() => Schema.decodeUnknownSync(WorkspaceIdSchema)('')).toThrow()
    })
  })

  describe('BlockIdSchema', () => {
    test('should accept valid block ID', () => {
      const result = Schema.decodeUnknownSync(BlockIdSchema)('hero-section')
      expect(result as string).toBe('hero-section')
    })

    test('should accept simple block ID', () => {
      const result = Schema.decodeUnknownSync(BlockIdSchema)('hero')
      expect(result as string).toBe('hero')
    })

    test('should reject block ID starting with number', () => {
      expect(() => Schema.decodeUnknownSync(BlockIdSchema)('123-section')).toThrow()
    })

    test('should reject block ID with uppercase', () => {
      expect(() => Schema.decodeUnknownSync(BlockIdSchema)('Hero-Section')).toThrow()
    })

    test('should reject block ID with underscores', () => {
      expect(() => Schema.decodeUnknownSync(BlockIdSchema)('hero_section')).toThrow()
    })

    test('should reject empty string', () => {
      expect(() => Schema.decodeUnknownSync(BlockIdSchema)('')).toThrow()
    })
  })

  describe('BrandedViewIdSchema', () => {
    test('should accept valid view ID', () => {
      const result = Schema.decodeUnknownSync(BrandedViewIdSchema)('active_tasks')
      expect(result as string).toBe('active_tasks')
    })

    test('should accept view ID with numbers', () => {
      const result = Schema.decodeUnknownSync(BrandedViewIdSchema)('view2')
      expect(result as string).toBe('view2')
    })

    test('should reject view ID starting with number', () => {
      expect(() => Schema.decodeUnknownSync(BrandedViewIdSchema)('2view')).toThrow()
    })

    test('should reject view ID with hyphens', () => {
      expect(() => Schema.decodeUnknownSync(BrandedViewIdSchema)('active-tasks')).toThrow()
    })

    test('should reject empty string', () => {
      expect(() => Schema.decodeUnknownSync(BrandedViewIdSchema)('')).toThrow()
    })
  })

  describe('Type safety (compile-time)', () => {
    // These tests verify that branded types prevent mixing different ID types
    // The type assertions are checked at compile time by TypeScript

    test('branded types should be distinguishable', () => {
      // Each branded ID should have a unique type
      // This is a runtime check that decoding works correctly
      const tableId = Schema.decodeUnknownSync(TableIdSchema)(1)
      const fieldId = Schema.decodeUnknownSync(FieldIdSchema)(1)

      // Both have the same runtime value but different types
      expect(tableId as number).toBe(1)
      expect(fieldId as number).toBe(1)

      // At compile time, TypeScript would error if you tried:
      // const wrongTableId: TableId = fieldId  // Error!
      // const wrongFieldId: FieldId = tableId  // Error!
    })
  })
})
