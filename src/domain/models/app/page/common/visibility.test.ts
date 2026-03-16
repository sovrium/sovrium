/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { VisibilitySchema } from './visibility'

describe('VisibilitySchema', () => {
  test('should accept authenticated visibility', () => {
    const result = Schema.decodeUnknownSync(VisibilitySchema)({
      when: 'authenticated',
    })
    expect(result.when).toBe('authenticated')
  })

  test('should accept unauthenticated visibility', () => {
    const result = Schema.decodeUnknownSync(VisibilitySchema)({
      when: 'unauthenticated',
    })
    expect(result.when).toBe('unauthenticated')
  })

  test('should accept role-based visibility', () => {
    const result = Schema.decodeUnknownSync(VisibilitySchema)({
      roles: ['admin', 'editor'],
    })
    expect(result.roles).toEqual(['admin', 'editor'])
  })

  test('should accept combined when + roles', () => {
    const result = Schema.decodeUnknownSync(VisibilitySchema)({
      when: 'authenticated',
      roles: ['admin'],
    })
    expect(result.when).toBe('authenticated')
    expect(result.roles).toEqual(['admin'])
  })

  test('should accept empty object (no constraints)', () => {
    const result = Schema.decodeUnknownSync(VisibilitySchema)({})
    expect(result.when).toBeUndefined()
    expect(result.roles).toBeUndefined()
  })

  test('should reject invalid when value', () => {
    expect(() =>
      Schema.decodeUnknownSync(VisibilitySchema)({
        when: 'admin',
      })
    ).toThrow()
  })

  test('should reject empty roles array', () => {
    expect(() =>
      Schema.decodeUnknownSync(VisibilitySchema)({
        roles: [],
      })
    ).toThrow()
  })
})
