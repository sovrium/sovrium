/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { BaseFieldSchema, FieldPermissionsSchema } from './base-field'

describe('FieldPermissionsSchema', () => {
  describe('valid permissions', () => {
    test('should accept empty permissions object', () => {
      const result = Schema.decodeUnknownSync(FieldPermissionsSchema)({})
      expect(result).toEqual({})
    })

    test('should accept read-only permissions', () => {
      const permissions = { read: ['admin', 'hr'] }
      const result = Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept write-only permissions', () => {
      const permissions = { write: ['admin'] }
      const result = Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept both read and write permissions', () => {
      const permissions = { read: ['admin', 'hr'], write: ['admin'] }
      const result = Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept empty arrays', () => {
      const permissions = { read: [], write: [] }
      const result = Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept single role', () => {
      const permissions = { read: ['admin'] }
      const result = Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })

    test('should accept multiple roles', () => {
      const permissions = { read: ['admin', 'hr', 'manager', 'owner'] }
      const result = Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)
      expect(result).toEqual(permissions)
    })
  })

  describe('invalid permissions', () => {
    test('should reject read as string', () => {
      const permissions = { read: 'admin' }
      expect(() => Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject write as string', () => {
      const permissions = { write: 'admin' }
      expect(() => Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject non-string array elements', () => {
      const permissions = { read: [1, 2, 3] }
      expect(() => Schema.decodeUnknownSync(FieldPermissionsSchema)(permissions)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(FieldPermissionsSchema)(null)).toThrow()
    })

    test('should reject array instead of object', () => {
      expect(() => Schema.decodeUnknownSync(FieldPermissionsSchema)(['admin'])).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(FieldPermissionsSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Field Permissions')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(FieldPermissionsSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toContain('Role-based')
      }
    })
  })
})

describe('BaseFieldSchema', () => {
  describe('valid base fields', () => {
    test('should accept minimal field', () => {
      const field = { id: 1, name: 'email' }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with required', () => {
      const field = { id: 1, name: 'email', required: true }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with unique', () => {
      const field = { id: 1, name: 'email', unique: true }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with indexed', () => {
      const field = { id: 1, name: 'status', indexed: true }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with permissions', () => {
      const field = {
        id: 1,
        name: 'salary',
        permissions: { read: ['admin', 'hr'], write: ['hr'] },
      }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with all properties', () => {
      const field = {
        id: 1,
        name: 'salary',
        required: true,
        unique: false,
        indexed: true,
        permissions: { read: ['admin', 'hr'], write: ['hr'] },
      }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result).toEqual(field)
    })

    test('should accept field with large numeric id', () => {
      // IdSchema requires positive integers >= 1
      const field = { id: 999, name: 'email' }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result.id).toBe(999)
      expect(result.name).toBe('email')
    })
  })

  describe('invalid base fields', () => {
    test('should reject missing id', () => {
      const field = { name: 'email' }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject missing name', () => {
      const field = { id: 1 }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject empty name', () => {
      const field = { id: 1, name: '' }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject invalid permissions', () => {
      const field = { id: 1, name: 'salary', permissions: 'admin' }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject non-boolean required', () => {
      const field = { id: 1, name: 'email', required: 'yes' }
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(field)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(BaseFieldSchema)(null)).toThrow()
    })
  })

  describe('field with permissions use cases', () => {
    test('should accept HR-sensitive field (salary)', () => {
      const field = {
        id: 4,
        name: 'salary',
        permissions: { read: ['admin', 'hr'], write: ['hr'] },
      }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result.permissions?.read).toContain('hr')
      expect(result.permissions?.write).toContain('hr')
    })

    test('should accept highly sensitive field (SSN)', () => {
      const field = {
        id: 5,
        name: 'ssn',
        permissions: { read: ['hr'], write: ['hr'] },
      }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result.permissions?.read).toEqual(['hr'])
    })

    test('should accept admin-only write field', () => {
      const field = {
        id: 3,
        name: 'role',
        permissions: { write: ['admin'] },
      }
      const result = Schema.decodeUnknownSync(BaseFieldSchema)(field)
      expect(result.permissions?.read).toBeUndefined() // All can read
      expect(result.permissions?.write).toEqual(['admin'])
    })
  })
})
