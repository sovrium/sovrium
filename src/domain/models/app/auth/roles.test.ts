/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  BUILT_IN_ROLES,
  BUILT_IN_ROLE_LEVELS,
  BuiltInRoleSchema,
  RoleNameSchema,
  RoleDefinitionSchema,
  RolesConfigSchema,
  DefaultRoleSchema,
} from './roles'

describe('BUILT_IN_ROLES', () => {
  test('should contain exactly 3 roles', () => {
    expect(BUILT_IN_ROLES).toHaveLength(3)
  })

  test('should contain admin, member, viewer', () => {
    expect(BUILT_IN_ROLES).toEqual(['admin', 'member', 'viewer'])
  })

  test('should not contain owner', () => {
    expect(BUILT_IN_ROLES).not.toContain('owner')
  })
})

describe('BUILT_IN_ROLE_LEVELS', () => {
  test('should assign admin the highest level', () => {
    expect(BUILT_IN_ROLE_LEVELS['admin']).toBe(80)
  })

  test('should assign member a middle level', () => {
    expect(BUILT_IN_ROLE_LEVELS['member']).toBe(40)
  })

  test('should assign viewer the lowest level', () => {
    expect(BUILT_IN_ROLE_LEVELS['viewer']).toBe(10)
  })

  test('should have correct hierarchy ordering', () => {
    expect(BUILT_IN_ROLE_LEVELS['admin']).toBeGreaterThan(BUILT_IN_ROLE_LEVELS['member']!)
    expect(BUILT_IN_ROLE_LEVELS['member']).toBeGreaterThan(BUILT_IN_ROLE_LEVELS['viewer']!)
  })
})

describe('BuiltInRoleSchema', () => {
  test('should accept admin', () => {
    expect(Schema.decodeUnknownSync(BuiltInRoleSchema)('admin')).toBe('admin')
  })

  test('should accept member', () => {
    expect(Schema.decodeUnknownSync(BuiltInRoleSchema)('member')).toBe('member')
  })

  test('should accept viewer', () => {
    expect(Schema.decodeUnknownSync(BuiltInRoleSchema)('viewer')).toBe('viewer')
  })

  test('should reject owner', () => {
    expect(() => Schema.decodeUnknownSync(BuiltInRoleSchema)('owner')).toThrow()
  })

  test('should reject unknown role', () => {
    expect(() => Schema.decodeUnknownSync(BuiltInRoleSchema)('superadmin')).toThrow()
  })
})

describe('RoleNameSchema', () => {
  describe('valid names', () => {
    test('should accept simple lowercase name', () => {
      expect(Schema.decodeUnknownSync(RoleNameSchema)('editor')).toBe('editor')
    })

    test('should accept name with hyphens', () => {
      expect(Schema.decodeUnknownSync(RoleNameSchema)('content-manager')).toBe('content-manager')
    })

    test('should accept name with numbers', () => {
      expect(Schema.decodeUnknownSync(RoleNameSchema)('tier2-support')).toBe('tier2-support')
    })
  })

  describe('invalid names', () => {
    test('should reject uppercase', () => {
      expect(() => Schema.decodeUnknownSync(RoleNameSchema)('Editor')).toThrow()
    })

    test('should reject starting with number', () => {
      expect(() => Schema.decodeUnknownSync(RoleNameSchema)('123role')).toThrow()
    })

    test('should reject spaces', () => {
      expect(() => Schema.decodeUnknownSync(RoleNameSchema)('my role')).toThrow()
    })

    test('should reject underscores', () => {
      expect(() => Schema.decodeUnknownSync(RoleNameSchema)('my_role')).toThrow()
    })

    test('should reject empty string', () => {
      expect(() => Schema.decodeUnknownSync(RoleNameSchema)('')).toThrow()
    })
  })
})

describe('RoleDefinitionSchema', () => {
  test('should accept minimal definition', () => {
    const input = { name: 'editor' }
    const result = Schema.decodeUnknownSync(RoleDefinitionSchema)(input)
    expect(result.name).toBe('editor')
  })

  test('should accept full definition', () => {
    const input = { name: 'editor', description: 'Can edit content', level: 30 }
    const result = Schema.decodeUnknownSync(RoleDefinitionSchema)(input)
    expect(result).toEqual(input)
  })

  test('should reject missing name', () => {
    expect(() =>
      Schema.decodeUnknownSync(RoleDefinitionSchema)({ description: 'No name' })
    ).toThrow()
  })

  test('should reject invalid name format', () => {
    expect(() => Schema.decodeUnknownSync(RoleDefinitionSchema)({ name: 'Invalid Name' })).toThrow()
  })
})

describe('RolesConfigSchema', () => {
  describe('valid configurations', () => {
    test('should accept empty array', () => {
      const result = Schema.decodeUnknownSync(RolesConfigSchema)([])
      expect(result).toEqual([])
    })

    test('should accept single custom role', () => {
      const input = [{ name: 'editor', level: 30 }]
      const result = Schema.decodeUnknownSync(RolesConfigSchema)(input)
      expect(result).toHaveLength(1)
    })

    test('should accept multiple custom roles', () => {
      const input = [
        { name: 'editor', level: 30 },
        { name: 'moderator', level: 20 },
      ]
      const result = Schema.decodeUnknownSync(RolesConfigSchema)(input)
      expect(result).toHaveLength(2)
    })
  })

  describe('invalid configurations', () => {
    test('should reject duplicate role names', () => {
      const input = [{ name: 'editor' }, { name: 'editor' }]
      expect(() => Schema.decodeUnknownSync(RolesConfigSchema)(input)).toThrow()
    })

    test('should reject role names conflicting with built-in roles', () => {
      const input = [{ name: 'admin', level: 90 }]
      expect(() => Schema.decodeUnknownSync(RolesConfigSchema)(input)).toThrow()
    })

    test('should reject member as custom role name', () => {
      const input = [{ name: 'member' }]
      expect(() => Schema.decodeUnknownSync(RolesConfigSchema)(input)).toThrow()
    })

    test('should reject viewer as custom role name', () => {
      const input = [{ name: 'viewer' }]
      expect(() => Schema.decodeUnknownSync(RolesConfigSchema)(input)).toThrow()
    })
  })
})

describe('DefaultRoleSchema', () => {
  test('should accept built-in role name', () => {
    expect(Schema.decodeUnknownSync(DefaultRoleSchema)('member')).toBe('member')
  })

  test('should accept custom role name', () => {
    expect(Schema.decodeUnknownSync(DefaultRoleSchema)('editor')).toBe('editor')
  })

  test('should accept any string value', () => {
    expect(Schema.decodeUnknownSync(DefaultRoleSchema)('viewer')).toBe('viewer')
  })
})
