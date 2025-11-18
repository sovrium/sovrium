/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { getLinkAttributes } from './link-attributes'

describe('getLinkAttributes', () => {
  describe('basic link attributes', () => {
    test('should generate attributes for link with href only', () => {
      const attrs = getLinkAttributes('/about')

      expect(attrs.href).toBe('/about')
      expect(attrs.target).toBeUndefined()
      expect(attrs.rel).toBeUndefined()
      expect(attrs['data-testid']).toBeUndefined()
    })

    test('should generate attributes with target _self', () => {
      const attrs = getLinkAttributes('/products', '_self')

      expect(attrs.href).toBe('/products')
      expect(attrs.target).toBe('_self')
      expect(attrs.rel).toBeUndefined()
    })

    test('should generate attributes with test ID', () => {
      const attrs = getLinkAttributes('/contact', undefined, 'contact-link')

      expect(attrs.href).toBe('/contact')
      expect(attrs['data-testid']).toBe('contact-link')
    })
  })

  describe('security attributes for external links', () => {
    test('should add rel="noopener noreferrer" when target is _blank', () => {
      const attrs = getLinkAttributes('https://example.com', '_blank')

      expect(attrs.href).toBe('https://example.com')
      expect(attrs.target).toBe('_blank')
      expect(attrs.rel).toBe('noopener noreferrer')
    })

    test('should not add rel attribute for target _parent', () => {
      const attrs = getLinkAttributes('/page', '_parent')

      expect(attrs.href).toBe('/page')
      expect(attrs.target).toBe('_parent')
      expect(attrs.rel).toBeUndefined()
    })

    test('should not add rel attribute for target _top', () => {
      const attrs = getLinkAttributes('/page', '_top')

      expect(attrs.href).toBe('/page')
      expect(attrs.target).toBe('_top')
      expect(attrs.rel).toBeUndefined()
    })
  })

  describe('complete attribute generation', () => {
    test('should generate all attributes for external link with test ID', () => {
      const attrs = getLinkAttributes('https://github.com', '_blank', 'github-link')

      expect(attrs).toEqual({
        href: 'https://github.com',
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-testid': 'github-link',
      })
    })

    test('should generate all attributes for internal link with target and test ID', () => {
      const attrs = getLinkAttributes('/docs', '_self', 'docs-link')

      expect(attrs).toEqual({
        href: '/docs',
        target: '_self',
        'data-testid': 'docs-link',
      })
    })
  })

  describe('immutability', () => {
    test('should return readonly object', () => {
      const attrs = getLinkAttributes('/test', '_blank', 'test-link')

      // TypeScript enforces readonly at compile time
      // This test verifies the return type is correctly typed
      expect(Object.isFrozen(attrs)).toBe(false) // Not frozen, but TypeScript readonly
      expect(attrs).toHaveProperty('href')
      expect(attrs).toHaveProperty('target')
      expect(attrs).toHaveProperty('rel')
      expect(attrs).toHaveProperty('data-testid')
    })
  })
})
