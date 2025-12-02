/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { FieldPermissionSchema, TableFieldPermissionsSchema } from './field-permission'

describe('FieldPermissionSchema', () => {
  describe('valid configurations', () => {
    test('should accept field with read permission only', () => {
      const input = {
        field: 'salary',
        read: { type: 'roles' as const, roles: ['admin'] },
      }
      const result = Schema.decodeUnknownSync(FieldPermissionSchema)(input)
      expect(result).toEqual({
        field: 'salary',
        read: { type: 'roles', roles: ['admin'] },
      })
    })

    test('should accept field with write permission only', () => {
      const input = {
        field: 'email',
        write: { type: 'owner' as const, field: 'user_id' },
      }
      const result = Schema.decodeUnknownSync(FieldPermissionSchema)(input)
      expect(result).toEqual({
        field: 'email',
        write: { type: 'owner', field: 'user_id' },
      })
    })

    test('should accept field with both read and write permissions', () => {
      const input = {
        field: 'email',
        read: { type: 'authenticated' as const },
        write: { type: 'owner' as const, field: 'user_id' },
      }
      const result = Schema.decodeUnknownSync(FieldPermissionSchema)(input)
      expect(result).toEqual({
        field: 'email',
        read: { type: 'authenticated' },
        write: { type: 'owner', field: 'user_id' },
      })
    })

    test('should accept field name only (inherits table permissions)', () => {
      const input = { field: 'description' }
      const result = Schema.decodeUnknownSync(FieldPermissionSchema)(input)
      expect(result).toEqual({ field: 'description' })
    })

    test('should accept public read permission', () => {
      const input = {
        field: 'title',
        read: { type: 'public' as const },
      }
      const result = Schema.decodeUnknownSync(FieldPermissionSchema)(input)
      expect(result).toEqual({
        field: 'title',
        read: { type: 'public' },
      })
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing field name', () => {
      expect(() =>
        Schema.decodeUnknownSync(FieldPermissionSchema)({
          read: { type: 'authenticated' },
        })
      ).toThrow()
    })

    test('should reject invalid permission type', () => {
      expect(() =>
        Schema.decodeUnknownSync(FieldPermissionSchema)({
          field: 'salary',
          read: { type: 'invalid' },
        })
      ).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(FieldPermissionSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Field Permission')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(FieldPermissionSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toContain('permission')
      }
    })
  })
})

describe('TableFieldPermissionsSchema', () => {
  test('should accept array of field permissions', () => {
    const input = [
      { field: 'salary', read: { type: 'roles' as const, roles: ['admin'] } },
      { field: 'email', read: { type: 'authenticated' as const } },
    ]
    const result = Schema.decodeUnknownSync(TableFieldPermissionsSchema)(input)
    expect(result).toHaveLength(2)
    expect(result[0]!.field).toBe('salary')
    expect(result[1]!.field).toBe('email')
  })

  test('should accept empty array', () => {
    const result = Schema.decodeUnknownSync(TableFieldPermissionsSchema)([])
    expect(result).toEqual([])
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(TableFieldPermissionsSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Table Field Permissions')
      }
    })
  })
})
