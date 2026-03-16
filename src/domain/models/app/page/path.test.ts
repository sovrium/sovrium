/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PagePathSchema } from './path'

describe('PagePathSchema', () => {
  describe('valid paths', () => {
    test('should accept root path', () => {
      const result = Schema.decodeUnknownSync(PagePathSchema)('/')
      expect(result).toBe('/')
    })

    test('should accept simple path', () => {
      const result = Schema.decodeUnknownSync(PagePathSchema)('/about')
      expect(result).toBe('/about')
    })

    test('should accept nested path', () => {
      const result = Schema.decodeUnknownSync(PagePathSchema)('/products/inventory')
      expect(result).toBe('/products/inventory')
    })

    test('should accept kebab-case path', () => {
      const result = Schema.decodeUnknownSync(PagePathSchema)('/our-team')
      expect(result).toBe('/our-team')
    })

    test('should accept dynamic path parameter', () => {
      const result = Schema.decodeUnknownSync(PagePathSchema)('/blog/:slug')
      expect(result).toBe('/blog/:slug')
    })

    test('should accept multiple dynamic parameters', () => {
      const result = Schema.decodeUnknownSync(PagePathSchema)('/users/:user_id/posts/:post_id')
      expect(result).toBe('/users/:user_id/posts/:post_id')
    })

    test('should accept path with underscore', () => {
      const result = Schema.decodeUnknownSync(PagePathSchema)('/api_v2/users')
      expect(result).toBe('/api_v2/users')
    })
  })

  describe('invalid paths', () => {
    test('should reject empty string', () => {
      expect(() => Schema.decodeUnknownSync(PagePathSchema)('')).toThrow()
    })

    test('should reject path without leading slash', () => {
      expect(() => Schema.decodeUnknownSync(PagePathSchema)('about')).toThrow()
    })

    test('should reject path with uppercase letters', () => {
      expect(() => Schema.decodeUnknownSync(PagePathSchema)('/About')).toThrow()
    })

    test('should reject path with spaces', () => {
      expect(() => Schema.decodeUnknownSync(PagePathSchema)('/about us')).toThrow()
    })

    test('should reject path with special characters', () => {
      expect(() => Schema.decodeUnknownSync(PagePathSchema)('/about@us')).toThrow()
    })
  })
})
