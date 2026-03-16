/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  ResourceNameSchema,
  ActionNameSchema,
  ActionWithWildcardSchema,
  ResourceActionPermissionsSchema,
} from './resource-action'

describe('ResourceNameSchema', () => {
  test('should accept simple resource names', () => {
    expect(Schema.decodeUnknownSync(ResourceNameSchema)('users')).toBe('users')
    expect(Schema.decodeUnknownSync(ResourceNameSchema)('posts')).toBe('posts')
  })

  test('should accept resource names with underscores', () => {
    expect(Schema.decodeUnknownSync(ResourceNameSchema)('api_keys')).toBe('api_keys')
    expect(Schema.decodeUnknownSync(ResourceNameSchema)('user_profiles')).toBe('user_profiles')
  })

  test('should accept resource names with hyphens', () => {
    expect(Schema.decodeUnknownSync(ResourceNameSchema)('user-profiles')).toBe('user-profiles')
  })

  test('should accept resource names with numbers', () => {
    expect(Schema.decodeUnknownSync(ResourceNameSchema)('api2')).toBe('api2')
    expect(Schema.decodeUnknownSync(ResourceNameSchema)('users123')).toBe('users123')
  })

  test('should reject names starting with numbers', () => {
    expect(() => Schema.decodeUnknownSync(ResourceNameSchema)('123users')).toThrow()
  })

  test('should reject names starting with underscore', () => {
    expect(() => Schema.decodeUnknownSync(ResourceNameSchema)('_users')).toThrow()
  })

  test('should reject names starting with hyphen', () => {
    expect(() => Schema.decodeUnknownSync(ResourceNameSchema)('-users')).toThrow()
  })

  test('should reject empty string', () => {
    expect(() => Schema.decodeUnknownSync(ResourceNameSchema)('')).toThrow()
  })

  test('should reject non-string values', () => {
    expect(() => Schema.decodeUnknownSync(ResourceNameSchema)(123)).toThrow()
    expect(() => Schema.decodeUnknownSync(ResourceNameSchema)(null)).toThrow()
  })
})

describe('ActionNameSchema', () => {
  test('should accept common action names', () => {
    expect(Schema.decodeUnknownSync(ActionNameSchema)('read')).toBe('read')
    expect(Schema.decodeUnknownSync(ActionNameSchema)('write')).toBe('write')
    expect(Schema.decodeUnknownSync(ActionNameSchema)('create')).toBe('create')
    expect(Schema.decodeUnknownSync(ActionNameSchema)('update')).toBe('update')
    expect(Schema.decodeUnknownSync(ActionNameSchema)('delete')).toBe('delete')
  })

  test('should accept action names with underscores', () => {
    expect(Schema.decodeUnknownSync(ActionNameSchema)('list_all')).toBe('list_all')
  })

  test('should accept action names with hyphens', () => {
    expect(Schema.decodeUnknownSync(ActionNameSchema)('soft-delete')).toBe('soft-delete')
  })

  test('should reject names starting with numbers', () => {
    expect(() => Schema.decodeUnknownSync(ActionNameSchema)('123read')).toThrow()
  })

  test('should reject names starting with underscore', () => {
    expect(() => Schema.decodeUnknownSync(ActionNameSchema)('_read')).toThrow()
  })
})

describe('ActionWithWildcardSchema', () => {
  test('should accept wildcard', () => {
    expect(Schema.decodeUnknownSync(ActionWithWildcardSchema)('*')).toBe('*')
  })

  test('should accept regular action names', () => {
    expect(Schema.decodeUnknownSync(ActionWithWildcardSchema)('read')).toBe('read')
    expect(Schema.decodeUnknownSync(ActionWithWildcardSchema)('write')).toBe('write')
  })

  test('should reject invalid action names', () => {
    expect(() => Schema.decodeUnknownSync(ActionWithWildcardSchema)('123invalid')).toThrow()
  })

  test('should reject double wildcard', () => {
    expect(() => Schema.decodeUnknownSync(ActionWithWildcardSchema)('**')).toThrow()
  })
})

describe('ResourceActionPermissionsSchema', () => {
  test('should accept valid resource:action mapping', () => {
    const permissions = {
      users: ['read', 'list'],
      posts: ['create', 'read', 'update', 'delete'],
    }
    const result = Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(permissions)
    expect(result).toEqual(permissions)
  })

  test('should accept wildcard actions', () => {
    const permissions = {
      analytics: ['*'],
      users: ['read'],
    }
    const result = Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(permissions)
    expect(result).toEqual(permissions)
  })

  test('should accept single resource with single action', () => {
    const permissions = {
      posts: ['read'],
    }
    const result = Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(permissions)
    expect(result).toEqual(permissions)
  })

  test('should accept empty object', () => {
    const result = Schema.decodeUnknownSync(ResourceActionPermissionsSchema)({})
    expect(result).toEqual({})
  })

  test('should reject resource with empty actions array', () => {
    const permissions = {
      users: [],
    }
    expect(() => Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(permissions)).toThrow()
  })

  test('should strip invalid resource name and return empty object', () => {
    // GIVEN: Resource name starting with number (invalid pattern)
    const permissions = {
      '123invalid': ['read'],
    }

    // WHEN: The permissions are validated against the schema
    const result = Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(permissions)

    // THEN: Effect Schema strips invalid keys, returning empty object
    expect(result).toEqual({})
  })

  test('should reject invalid action name', () => {
    const permissions = {
      users: ['123invalid'],
    }
    expect(() => Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(permissions)).toThrow()
  })

  test('should reject non-array action values', () => {
    const permissions = {
      users: 'read',
    }
    expect(() => Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(permissions)).toThrow()
  })

  test('should reject non-object values', () => {
    expect(() => Schema.decodeUnknownSync(ResourceActionPermissionsSchema)('invalid')).toThrow()
    expect(() => Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(123)).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(ResourceActionPermissionsSchema)(['users', 'read'])
    ).toThrow()
  })
})
