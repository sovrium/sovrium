/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { OwnerPermissionSchema } from './owner'

describe('OwnerPermissionSchema', () => {
  describe('valid owner permissions', () => {
    test('should accept owner permission with owner_id field', () => {
      const permission = { type: 'owner' as const, field: 'owner_id' }
      const result = Schema.decodeUnknownSync(OwnerPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })

    test('should accept owner permission with user_id field', () => {
      const permission = { type: 'owner' as const, field: 'user_id' }
      const result = Schema.decodeUnknownSync(OwnerPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })

    test('should accept owner permission with created_by field', () => {
      const permission = { type: 'owner' as const, field: 'created_by' }
      const result = Schema.decodeUnknownSync(OwnerPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })

    test('should accept owner permission with custom field name', () => {
      const permission = { type: 'owner' as const, field: 'author_id' }
      const result = Schema.decodeUnknownSync(OwnerPermissionSchema)(permission)
      expect(result).toEqual(permission)
    })
  })

  describe('invalid owner permissions', () => {
    test('should reject missing field', () => {
      const permission = { type: 'owner' }
      expect(() => Schema.decodeUnknownSync(OwnerPermissionSchema)(permission)).toThrow()
    })

    test('should reject wrong type', () => {
      const permission = { type: 'public', field: 'owner_id' }
      expect(() => Schema.decodeUnknownSync(OwnerPermissionSchema)(permission)).toThrow()
    })

    test('should reject non-string field', () => {
      const permission = { type: 'owner', field: 123 }
      expect(() => Schema.decodeUnknownSync(OwnerPermissionSchema)(permission)).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(OwnerPermissionSchema)(null)).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(OwnerPermissionSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Owner Permission')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(OwnerPermissionSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toContain('owner')
      }
    })
  })
})
