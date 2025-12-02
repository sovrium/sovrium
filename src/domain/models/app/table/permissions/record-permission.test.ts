/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema, SchemaAST } from 'effect'
import { RecordPermissionSchema, RecordPermissionsSchema } from './record-permission'

describe('RecordPermissionSchema', () => {
  describe('valid configurations', () => {
    test('should accept read permission with userId condition', () => {
      const input = {
        action: 'read' as const,
        condition: '{userId} = created_by',
      }
      const result = Schema.decodeUnknownSync(RecordPermissionSchema)(input)
      expect(result).toEqual({
        action: 'read',
        condition: '{userId} = created_by',
      })
    })

    test('should accept update permission with owner condition', () => {
      const input = {
        action: 'update' as const,
        condition: '{userId} = owner_id',
      }
      const result = Schema.decodeUnknownSync(RecordPermissionSchema)(input)
      expect(result).toEqual({
        action: 'update',
        condition: '{userId} = owner_id',
      })
    })

    test('should accept create permission', () => {
      const input = {
        action: 'create' as const,
        condition: '{organizationId} = organization_id',
      }
      const result = Schema.decodeUnknownSync(RecordPermissionSchema)(input)
      expect(result).toEqual({
        action: 'create',
        condition: '{organizationId} = organization_id',
      })
    })

    test('should accept delete permission', () => {
      const input = {
        action: 'delete' as const,
        condition: "{userId} = owner_id AND {roles} && ARRAY['admin']",
      }
      const result = Schema.decodeUnknownSync(RecordPermissionSchema)(input)
      expect(result.action).toBe('delete')
      expect(result.condition).toContain('{userId}')
    })

    test('should accept organization-scoped access', () => {
      const input = {
        action: 'read' as const,
        condition: '{organizationId} = organization_id',
      }
      const result = Schema.decodeUnknownSync(RecordPermissionSchema)(input)
      expect(result).toEqual({
        action: 'read',
        condition: '{organizationId} = organization_id',
      })
    })
  })

  describe('invalid configurations', () => {
    test('should reject invalid action', () => {
      expect(() =>
        Schema.decodeUnknownSync(RecordPermissionSchema)({
          action: 'invalid',
          condition: '{userId} = owner_id',
        })
      ).toThrow()
    })

    test('should reject missing action', () => {
      expect(() =>
        Schema.decodeUnknownSync(RecordPermissionSchema)({
          condition: '{userId} = owner_id',
        })
      ).toThrow()
    })

    test('should reject missing condition', () => {
      expect(() =>
        Schema.decodeUnknownSync(RecordPermissionSchema)({
          action: 'read',
        })
      ).toThrow()
    })

    test('should reject non-string condition', () => {
      expect(() =>
        Schema.decodeUnknownSync(RecordPermissionSchema)({
          action: 'read',
          condition: 123,
        })
      ).toThrow()
    })
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(RecordPermissionSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Record Permission')
      }
    })

    test('should have description annotation', () => {
      const description = SchemaAST.getDescriptionAnnotation(RecordPermissionSchema.ast)
      expect(description._tag).toBe('Some')
      if (description._tag === 'Some') {
        expect(description.value).toContain('Row-level security')
      }
    })

    test('should have examples annotation', () => {
      const examples = SchemaAST.getExamplesAnnotation(RecordPermissionSchema.ast)
      expect(examples._tag).toBe('Some')
      if (examples._tag === 'Some') {
        expect(examples.value.length).toBeGreaterThanOrEqual(2)
      }
    })
  })
})

describe('RecordPermissionsSchema', () => {
  test('should accept array of record permissions', () => {
    const input = [
      { action: 'read' as const, condition: '{userId} = created_by' },
      { action: 'update' as const, condition: '{userId} = owner_id' },
    ]
    const result = Schema.decodeUnknownSync(RecordPermissionsSchema)(input)
    expect(result).toHaveLength(2)
    expect(result[0]!.action).toBe('read')
    expect(result[1]!.action).toBe('update')
  })

  test('should accept empty array', () => {
    const result = Schema.decodeUnknownSync(RecordPermissionsSchema)([])
    expect(result).toEqual([])
  })

  test('should accept all CRUD actions in array', () => {
    const input = [
      { action: 'create' as const, condition: 'true' },
      { action: 'read' as const, condition: 'true' },
      { action: 'update' as const, condition: '{userId} = owner_id' },
      { action: 'delete' as const, condition: '{userId} = owner_id' },
    ]
    const result = Schema.decodeUnknownSync(RecordPermissionsSchema)(input)
    expect(result).toHaveLength(4)
  })

  describe('schema metadata', () => {
    test('should have title annotation', () => {
      const title = SchemaAST.getTitleAnnotation(RecordPermissionsSchema.ast)
      expect(title._tag).toBe('Some')
      if (title._tag === 'Some') {
        expect(title.value).toBe('Record Permissions')
      }
    })
  })
})
