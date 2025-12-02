/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { CustomPermissionSchema } from './custom'

describe('CustomPermissionSchema', () => {
  describe('valid configurations', () => {
    test('should accept custom permission with user variable', () => {
      const input = { type: 'custom' as const, condition: '{userId} = owner_id' }
      const result = Schema.decodeUnknownSync(CustomPermissionSchema)(input)
      expect(result).toEqual({ type: 'custom', condition: '{userId} = owner_id' })
    })

    test('should accept custom permission with organization variable', () => {
      const input = {
        type: 'custom' as const,
        condition: "{organizationId} = org_id AND status = 'active'",
      }
      const result = Schema.decodeUnknownSync(CustomPermissionSchema)(input)
      expect(result).toEqual({
        type: 'custom',
        condition: "{organizationId} = org_id AND status = 'active'",
      })
    })

    test('should accept custom permission with roles variable', () => {
      const input = { type: 'custom' as const, condition: "'{roles}' && ARRAY['admin']" }
      const result = Schema.decodeUnknownSync(CustomPermissionSchema)(input)
      expect(result).toEqual({ type: 'custom', condition: "'{roles}' && ARRAY['admin']" })
    })

    test('should accept complex PostgreSQL expression', () => {
      const input = {
        type: 'custom' as const,
        condition:
          '{userId} = created_by OR {organizationId} = organization_id AND is_public = true',
      }
      const result = Schema.decodeUnknownSync(CustomPermissionSchema)(input)
      expect(result.type).toBe('custom')
      expect(result.condition).toContain('{userId}')
      expect(result.condition).toContain('{organizationId}')
    })
  })

  describe('invalid configurations', () => {
    test('should reject missing type', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomPermissionSchema)({ condition: '{userId} = owner_id' })
      ).toThrow()
    })

    test('should reject wrong type', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomPermissionSchema)({
          type: 'owner',
          condition: '{userId} = owner_id',
        })
      ).toThrow()
    })

    test('should reject missing condition', () => {
      expect(() => Schema.decodeUnknownSync(CustomPermissionSchema)({ type: 'custom' })).toThrow()
    })

    test('should reject non-string condition', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomPermissionSchema)({ type: 'custom', condition: 123 })
      ).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(CustomPermissionSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Custom Permission')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(CustomPermissionSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toContain('RLS condition')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(CustomPermissionSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value).toHaveLength(2)
      }
    })
  })
})
