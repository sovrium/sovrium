/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PageAccessSchema, PageAccessExtendedSchema } from './access'

describe('PageAccessExtendedSchema', () => {
  test('should accept extended form with require and redirectTo', () => {
    const result = Schema.decodeUnknownSync(PageAccessExtendedSchema)({
      require: 'authenticated',
      redirectTo: '/login',
    })
    expect(result.require).toBe('authenticated')
    expect(result.redirectTo).toBe('/login')
  })

  test('should accept extended form with require only', () => {
    const result = Schema.decodeUnknownSync(PageAccessExtendedSchema)({
      require: 'authenticated',
    })
    expect(result.require).toBe('authenticated')
    expect(result.redirectTo).toBeUndefined()
  })

  test('should accept role array in require field', () => {
    const result = Schema.decodeUnknownSync(PageAccessExtendedSchema)({
      require: ['admin'],
      redirectTo: '/403',
    })
    expect(result.require).toEqual(['admin'])
    expect(result.redirectTo).toBe('/403')
  })

  test('should reject redirectTo without leading slash', () => {
    expect(() =>
      Schema.decodeUnknownSync(PageAccessExtendedSchema)({
        require: 'authenticated',
        redirectTo: 'login',
      })
    ).toThrow()
  })
})

describe('PageAccessSchema', () => {
  describe('simple string forms', () => {
    test('should accept "all" permission', () => {
      const result = Schema.decodeUnknownSync(PageAccessSchema)('all')
      expect(result).toBe('all')
    })

    test('should accept "authenticated" permission', () => {
      const result = Schema.decodeUnknownSync(PageAccessSchema)('authenticated')
      expect(result).toBe('authenticated')
    })
  })

  describe('role array form', () => {
    test('should accept single role array', () => {
      const result = Schema.decodeUnknownSync(PageAccessSchema)(['admin'])
      expect(result).toEqual(['admin'])
    })

    test('should accept multiple roles array', () => {
      const result = Schema.decodeUnknownSync(PageAccessSchema)(['admin', 'editor'])
      expect(result).toEqual(['admin', 'editor'])
    })

    test('should reject empty array', () => {
      expect(() => Schema.decodeUnknownSync(PageAccessSchema)([])).toThrow()
    })
  })

  describe('extended object form', () => {
    test('should accept extended form with redirect', () => {
      const result = Schema.decodeUnknownSync(PageAccessSchema)({
        require: 'authenticated',
        redirectTo: '/login',
      })
      expect(result).toEqual({ require: 'authenticated', redirectTo: '/login' })
    })

    test('should accept extended form with role array and redirect', () => {
      const result = Schema.decodeUnknownSync(PageAccessSchema)({
        require: ['admin', 'editor'],
        redirectTo: '/unauthorized',
      })
      expect(result).toEqual({ require: ['admin', 'editor'], redirectTo: '/unauthorized' })
    })
  })

  describe('invalid inputs', () => {
    test('should reject unknown string', () => {
      expect(() => Schema.decodeUnknownSync(PageAccessSchema)('unknown')).toThrow()
    })

    test('should reject null', () => {
      expect(() => Schema.decodeUnknownSync(PageAccessSchema)(null)).toThrow()
    })

    test('should reject number', () => {
      expect(() => Schema.decodeUnknownSync(PageAccessSchema)(42)).toThrow()
    })
  })
})
