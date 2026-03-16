/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { TablePermissionsSchema } from '.'

describe('TablePermissionsSchema', () => {
  describe('valid table permissions', () => {
    test('should accept empty permissions object', () => {
      const permissions = {}
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept read-only permission', () => {
      const permissions = { read: 'all' as const }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept all CRUD permissions', () => {
      const permissions = {
        read: ['member'] as string[],
        create: ['admin'] as string[],
        update: 'authenticated' as const,
        delete: ['admin'] as string[],
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept mixed permission types', () => {
      const permissions = {
        read: 'all' as const,
        create: ['admin', 'editor'] as string[],
        update: 'authenticated' as const,
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })
  })

  describe('invalid table permissions', () => {
    test('should reject invalid permission type', () => {
      const permissions = { read: 'invalid' }
      expect(() => Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(TablePermissionsSchema)(null)).toThrow()
    })
  })

  describe('real-world use cases', () => {
    test('should accept public read, admin-only write pattern', () => {
      const permissions = {
        read: 'all' as const,
        create: ['admin'] as string[],
        update: ['admin'] as string[],
        delete: ['admin'] as string[],
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.read).toBe('all')
      expect(result.create).toEqual(['admin'])
    })

    test('should accept member read, admin create/delete pattern', () => {
      const permissions = {
        read: ['member'] as string[],
        create: ['admin'] as string[],
        update: 'authenticated' as const,
        delete: ['admin'] as string[],
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(Array.isArray(result.read)).toBe(true)
      if (Array.isArray(result.read)) {
        expect(result.read).toContain('member')
      }
    })

    test('should accept authenticated-only access pattern', () => {
      const permissions = {
        read: 'authenticated' as const,
        create: 'authenticated' as const,
        update: 'authenticated' as const,
        delete: 'authenticated' as const,
      }
      const result = Schema.decodeUnknownSync(TablePermissionsSchema)(permissions)
      expect(result.read).toBe('authenticated')
      expect(result.create).toBe('authenticated')
    })
  })
})
