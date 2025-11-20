/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { IdSchema, NameSchema, PathSchema } from './definitions'

describe('IdSchema', () => {
  test('should accept valid positive integers', () => {
    // GIVEN: Valid ID values
    const ids = [1, 2, 3, 100, 1000]

    // WHEN: Schema validation is performed on each
    const results = ids.map((id) => Schema.decodeUnknownSync(IdSchema)(id))

    // THEN: All IDs should be accepted
    expect(results).toEqual(ids)
  })

  test('should accept maximum safe integer', () => {
    // GIVEN: JavaScript MAX_SAFE_INTEGER
    const maxId = 9_007_199_254_740_991

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(IdSchema)(maxId)

    // THEN: Maximum ID should be accepted
    expect(result).toBe(maxId)
  })

  test('should reject zero', () => {
    // GIVEN: Zero value
    const id = 0

    // WHEN: Schema validation is performed
    // THEN: Zero should be rejected (minimum is 1)
    expect(() => Schema.decodeUnknownSync(IdSchema)(id)).toThrow()
  })

  test('should reject negative integers', () => {
    // GIVEN: Negative ID values
    const invalidIds = [-1, -10, -100]

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidIds.forEach((id) => {
      expect(() => Schema.decodeUnknownSync(IdSchema)(id)).toThrow()
    })
  })

  test('should reject non-integers', () => {
    // GIVEN: Non-integer values
    const invalidIds = [1.5, 2.7, 3.14]

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidIds.forEach((id) => {
      expect(() => Schema.decodeUnknownSync(IdSchema)(id)).toThrow()
    })
  })

  test('should reject values exceeding MAX_SAFE_INTEGER', () => {
    // GIVEN: Value exceeding JavaScript MAX_SAFE_INTEGER
    const tooLargeId = 9_007_199_254_740_992

    // WHEN: Schema validation is performed
    // THEN: Value should be rejected
    expect(() => Schema.decodeUnknownSync(IdSchema)(tooLargeId)).toThrow()
  })
})

describe('NameSchema', () => {
  test('should accept valid snake_case names', () => {
    // GIVEN: Valid database-style names
    const names = ['user', 'product', 'order_item', 'customer_email', 'shipping_address'] as const

    // WHEN: Schema validation is performed on each
    const results = names.map((name) => Schema.decodeUnknownSync(NameSchema)(name))

    // THEN: All names should be accepted
    expect(results).toEqual([...names])
  })

  test('should accept names starting with lowercase letter', () => {
    // GIVEN: Name starting with lowercase letter
    const name = 'user'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(NameSchema)(name)

    // THEN: Name should be accepted
    expect(result).toBe('user')
  })

  test('should accept names with numbers', () => {
    // GIVEN: Names with numbers after the first character
    const names = ['user1', 'product2', 'item_123']

    // WHEN: Schema validation is performed on each
    const results = names.map((name) => Schema.decodeUnknownSync(NameSchema)(name))

    // THEN: All names should be accepted
    expect(results).toEqual(names)
  })

  test('should accept names with underscores', () => {
    // GIVEN: Names with underscores (snake_case)
    const names = ['user_id', 'first_name', 'created_at']

    // WHEN: Schema validation is performed on each
    const results = names.map((name) => Schema.decodeUnknownSync(NameSchema)(name))

    // THEN: All names should be accepted
    expect(results).toEqual(names)
  })

  test('should accept maximum length (63 characters)', () => {
    // GIVEN: Name with 63 characters (PostgreSQL limit)
    const name = 'a'.repeat(63)

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(NameSchema)(name)

    // THEN: 63-character name should be accepted
    expect(result).toBe(name)
  })

  test('should reject empty string', () => {
    // GIVEN: Empty name
    const name = ''

    // WHEN: Schema validation is performed
    // THEN: Empty name should be rejected
    expect(() => Schema.decodeUnknownSync(NameSchema)(name)).toThrow()
  })

  test('should reject names exceeding 63 characters', () => {
    // GIVEN: Name with 64 characters (exceeds PostgreSQL limit)
    const name = 'a'.repeat(64)

    // WHEN: Schema validation is performed
    // THEN: Too-long name should be rejected
    expect(() => Schema.decodeUnknownSync(NameSchema)(name)).toThrow()
  })

  test('should reject names starting with uppercase', () => {
    // GIVEN: Name starting with uppercase letter
    const name = 'User'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected
    expect(() => Schema.decodeUnknownSync(NameSchema)(name)).toThrow()
  })

  test('should reject names starting with number', () => {
    // GIVEN: Name starting with number
    const name = '1user'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected
    expect(() => Schema.decodeUnknownSync(NameSchema)(name)).toThrow()
  })

  test('should reject names with hyphens (kebab-case)', () => {
    // GIVEN: Name with hyphens
    const name = 'user-name'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected (only underscores allowed)
    expect(() => Schema.decodeUnknownSync(NameSchema)(name)).toThrow()
  })

  test('should reject names with spaces', () => {
    // GIVEN: Name with spaces
    const name = 'user name'

    // WHEN: Schema validation is performed
    // THEN: Name should be rejected
    expect(() => Schema.decodeUnknownSync(NameSchema)(name)).toThrow()
  })
})

describe('PathSchema', () => {
  test('should accept root path', () => {
    // GIVEN: Root path
    const path = '/'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PathSchema)(path)

    // THEN: Root path should be accepted
    expect(result).toBe('/')
  })

  test('should accept single-level paths', () => {
    // GIVEN: Single-level URL paths
    const paths = ['/home', '/customers', '/admin']

    // WHEN: Schema validation is performed on each
    const results = paths.map((path) => Schema.decodeUnknownSync(PathSchema)(path))

    // THEN: All paths should be accepted
    expect(results).toEqual(paths)
  })

  test('should accept nested paths', () => {
    // GIVEN: Multi-level URL paths
    const paths = ['/products/inventory', '/admin/settings', '/reports/sales']

    // WHEN: Schema validation is performed on each
    const results = paths.map((path) => Schema.decodeUnknownSync(PathSchema)(path))

    // THEN: All nested paths should be accepted
    expect(results).toEqual(paths)
  })

  test('should accept kebab-case segments', () => {
    // GIVEN: Paths with kebab-case segments
    const paths = ['/our-team', '/contact-us', '/terms-of-service']

    // WHEN: Schema validation is performed on each
    const results = paths.map((path) => Schema.decodeUnknownSync(PathSchema)(path))

    // THEN: All kebab-case paths should be accepted
    expect(results).toEqual(paths)
  })

  test('should accept paths with numbers', () => {
    // GIVEN: Paths with numeric segments
    const paths = ['/blog/2024', '/product/123', '/user/456']

    // WHEN: Schema validation is performed on each
    const results = paths.map((path) => Schema.decodeUnknownSync(PathSchema)(path))

    // THEN: All paths should be accepted
    expect(results).toEqual(paths)
  })

  test('should reject paths without leading slash', () => {
    // GIVEN: Path without leading slash
    const path = 'home'

    // WHEN: Schema validation is performed
    // THEN: Path should be rejected
    expect(() => Schema.decodeUnknownSync(PathSchema)(path)).toThrow()
  })

  test('should reject paths with uppercase letters', () => {
    // GIVEN: Path with uppercase letters
    const path = '/Home'

    // WHEN: Schema validation is performed
    // THEN: Path should be rejected
    expect(() => Schema.decodeUnknownSync(PathSchema)(path)).toThrow()
  })

  test('should reject paths with spaces', () => {
    // GIVEN: Path with spaces
    const path = '/our team'

    // WHEN: Schema validation is performed
    // THEN: Path should be rejected
    expect(() => Schema.decodeUnknownSync(PathSchema)(path)).toThrow()
  })

  test('should accept paths with underscores', () => {
    // GIVEN: Path with underscores (e.g., /_docs/api for internal routes)
    const path = '/user_profile'

    // WHEN: Schema validation is performed
    // THEN: Path should be accepted (underscores allowed for backward compatibility)
    expect(() => Schema.decodeUnknownSync(PathSchema)(path)).not.toThrow()
    expect(Schema.decodeUnknownSync(PathSchema)(path)).toBe('/user_profile')
  })

  test('should reject empty string', () => {
    // GIVEN: Empty path
    const path = ''

    // WHEN: Schema validation is performed
    // THEN: Empty path should be rejected
    expect(() => Schema.decodeUnknownSync(PathSchema)(path)).toThrow()
  })
})
