/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PreloadSchema } from './preload'

describe('PreloadSchema', () => {
  test('should accept preload for stylesheet', () => {
    // GIVEN: Preload for critical CSS
    const preload = [
      {
        href: './output.css',
        as: 'style' as const,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: Stylesheet preload should be accepted
    expect(result[0].as).toBe('style')
    expect(result[0].href).toBe('./output.css')
  })

  test('should accept preload for font with crossorigin', () => {
    // GIVEN: Preload for web font with crossorigin attribute
    const preload = [
      {
        href: './fonts/Inter.woff2',
        as: 'font' as const,
        type: 'font/woff2',
        crossorigin: true,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: Font preload with crossorigin should be accepted
    expect(result[0].as).toBe('font')
    expect(result[0].type).toBe('font/woff2')
    expect(result[0].crossorigin).toBe(true)
  })

  test('should accept all 8 resource types', () => {
    // GIVEN: All 8 resource types
    const resourceTypes = [
      'style',
      'script',
      'font',
      'image',
      'video',
      'audio',
      'document',
      'fetch',
    ] as const

    resourceTypes.forEach((as) => {
      const preload = [{ href: './resource', as }]

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

      // THEN: Resource type should be accepted
      expect(result[0].as).toBe(as)
    })
  })

  test('should accept crossorigin as boolean true', () => {
    // GIVEN: Crossorigin as boolean true
    const preload = [
      {
        href: './fonts/Inter.woff2',
        as: 'font' as const,
        crossorigin: true,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: Boolean crossorigin should be accepted
    expect(result[0].crossorigin).toBe(true)
  })

  test('should accept crossorigin as boolean false', () => {
    // GIVEN: Crossorigin as boolean false
    const preload = [
      {
        href: './script.js',
        as: 'script' as const,
        crossorigin: false,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: Boolean crossorigin should be accepted
    expect(result[0].crossorigin).toBe(false)
  })

  test('should accept crossorigin as anonymous', () => {
    // GIVEN: Crossorigin as "anonymous"
    const preload = [
      {
        href: './fonts/Inter.woff2',
        as: 'font' as const,
        crossorigin: 'anonymous' as const,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: "anonymous" crossorigin should be accepted
    expect(result[0].crossorigin).toBe('anonymous')
  })

  test('should accept crossorigin as use-credentials', () => {
    // GIVEN: Crossorigin as "use-credentials"
    const preload = [
      {
        href: '/api/data',
        as: 'fetch' as const,
        crossorigin: 'use-credentials' as const,
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: "use-credentials" crossorigin should be accepted
    expect(result[0].crossorigin).toBe('use-credentials')
  })

  test('should accept media query for conditional loading', () => {
    // GIVEN: Preload with media query
    const preload = [
      {
        href: './hero-mobile.jpg',
        as: 'image' as const,
        type: 'image/jpeg',
        media: '(max-width: 767px)',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: Media query should be accepted
    expect(result[0].media).toBe('(max-width: 767px)')
  })

  test('should accept complete preload configuration', () => {
    // GIVEN: Complete preload with all properties
    const preload = [
      {
        href: './fonts/Inter-Bold.woff2',
        as: 'font' as const,
        type: 'font/woff2',
        crossorigin: true,
        media: '(min-width: 768px)',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: Complete configuration should be accepted
    expect(result[0].href).toBe('./fonts/Inter-Bold.woff2')
    expect(result[0].as).toBe('font')
    expect(result[0].type).toBe('font/woff2')
    expect(result[0].crossorigin).toBe(true)
    expect(result[0].media).toBe('(min-width: 768px)')
  })

  test('should accept multiple preload items', () => {
    // GIVEN: Multiple resources to preload
    const preload = [
      { href: './output.css', as: 'style' as const },
      { href: './fonts/Inter.woff2', as: 'font' as const, type: 'font/woff2', crossorigin: true },
      { href: './hero.jpg', as: 'image' as const, type: 'image/jpeg' },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PreloadSchema)(preload)

    // THEN: All preload items should be accepted
    expect(result).toHaveLength(3)
    expect(result[0].as).toBe('style')
    expect(result[1].as).toBe('font')
    expect(result[2].as).toBe('image')
  })

  test('should reject invalid resource type', () => {
    // GIVEN: Invalid resource type
    const preload = [
      {
        href: './resource',
        as: 'invalid',
      },
    ]

    // WHEN: Schema validation is performed
    // THEN: Should reject (invalid resource type)
    expect(() => Schema.decodeUnknownSync(PreloadSchema)(preload)).toThrow()
  })
})
