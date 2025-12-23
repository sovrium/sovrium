/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  StandardRoleSchema,
  AdminLevelRoleSchema,
  UserLevelRoleSchema,
  FlexibleRolesSchema,
  StandardRolesArraySchema,
} from './roles'

describe('StandardRoleSchema', () => {
  test('should accept owner role', () => {
    const result = Schema.decodeUnknownSync(StandardRoleSchema)('owner')
    expect(result).toBe('owner')
  })

  test('should accept admin role', () => {
    const result = Schema.decodeUnknownSync(StandardRoleSchema)('admin')
    expect(result).toBe('admin')
  })

  test('should accept member role', () => {
    const result = Schema.decodeUnknownSync(StandardRoleSchema)('member')
    expect(result).toBe('member')
  })

  test('should accept viewer role', () => {
    const result = Schema.decodeUnknownSync(StandardRoleSchema)('viewer')
    expect(result).toBe('viewer')
  })

  test('should reject unknown role', () => {
    expect(() => Schema.decodeUnknownSync(StandardRoleSchema)('superadmin')).toThrow()
  })

  test('should reject non-string values', () => {
    expect(() => Schema.decodeUnknownSync(StandardRoleSchema)(123)).toThrow()
    expect(() => Schema.decodeUnknownSync(StandardRoleSchema)(null)).toThrow()
    expect(() => Schema.decodeUnknownSync(StandardRoleSchema)(undefined)).toThrow()
  })
})

describe('AdminLevelRoleSchema', () => {
  test('should accept owner role', () => {
    const result = Schema.decodeUnknownSync(AdminLevelRoleSchema)('owner')
    expect(result).toBe('owner')
  })

  test('should accept admin role', () => {
    const result = Schema.decodeUnknownSync(AdminLevelRoleSchema)('admin')
    expect(result).toBe('admin')
  })

  test('should reject member role', () => {
    expect(() => Schema.decodeUnknownSync(AdminLevelRoleSchema)('member')).toThrow()
  })

  test('should reject viewer role', () => {
    expect(() => Schema.decodeUnknownSync(AdminLevelRoleSchema)('viewer')).toThrow()
  })
})

describe('UserLevelRoleSchema', () => {
  test('should accept admin role', () => {
    const result = Schema.decodeUnknownSync(UserLevelRoleSchema)('admin')
    expect(result).toBe('admin')
  })

  test('should accept user role', () => {
    const result = Schema.decodeUnknownSync(UserLevelRoleSchema)('user')
    expect(result).toBe('user')
  })

  test('should accept viewer role', () => {
    const result = Schema.decodeUnknownSync(UserLevelRoleSchema)('viewer')
    expect(result).toBe('viewer')
  })

  test('should reject owner role', () => {
    expect(() => Schema.decodeUnknownSync(UserLevelRoleSchema)('owner')).toThrow()
  })

  test('should reject member role', () => {
    expect(() => Schema.decodeUnknownSync(UserLevelRoleSchema)('member')).toThrow()
  })
})

describe('FlexibleRolesSchema', () => {
  test('should accept array with single role', () => {
    const result = Schema.decodeUnknownSync(FlexibleRolesSchema)(['admin'])
    expect(result).toEqual(['admin'])
  })

  test('should accept array with multiple roles', () => {
    const result = Schema.decodeUnknownSync(FlexibleRolesSchema)(['admin', 'member', 'viewer'])
    expect(result).toEqual(['admin', 'member', 'viewer'])
  })

  test('should accept custom role names', () => {
    const result = Schema.decodeUnknownSync(FlexibleRolesSchema)(['custom-role', 'editor'])
    expect(result).toEqual(['custom-role', 'editor'])
  })

  test('should reject empty array', () => {
    expect(() => Schema.decodeUnknownSync(FlexibleRolesSchema)([])).toThrow()
  })

  test('should reject non-array values', () => {
    expect(() => Schema.decodeUnknownSync(FlexibleRolesSchema)('admin')).toThrow()
    expect(() => Schema.decodeUnknownSync(FlexibleRolesSchema)(123)).toThrow()
  })

  test('should reject array with non-string elements', () => {
    expect(() => Schema.decodeUnknownSync(FlexibleRolesSchema)([1, 2, 3])).toThrow()
    expect(() => Schema.decodeUnknownSync(FlexibleRolesSchema)([null])).toThrow()
  })
})

describe('StandardRolesArraySchema', () => {
  test('should accept array with single standard role', () => {
    const result = Schema.decodeUnknownSync(StandardRolesArraySchema)(['admin'])
    expect(result).toEqual(['admin'])
  })

  test('should accept array with all standard roles', () => {
    const result = Schema.decodeUnknownSync(StandardRolesArraySchema)([
      'owner',
      'admin',
      'member',
      'viewer',
    ])
    expect(result).toEqual(['owner', 'admin', 'member', 'viewer'])
  })

  test('should reject empty array', () => {
    expect(() => Schema.decodeUnknownSync(StandardRolesArraySchema)([])).toThrow()
  })

  test('should reject array with custom roles', () => {
    expect(() =>
      Schema.decodeUnknownSync(StandardRolesArraySchema)(['admin', 'custom-role'])
    ).toThrow()
  })

  test('should reject array with invalid roles', () => {
    expect(() => Schema.decodeUnknownSync(StandardRolesArraySchema)(['superadmin'])).toThrow()
  })
})
