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
import { FaviconSetSchema } from './favicon-set'

describe('FaviconSetSchema', () => {
  test('should accept browser icon', () => {
    // GIVEN: Standard browser icon
    const faviconSet = [
      {
        rel: 'icon' as const,
        type: 'image/png',
        sizes: '32x32',
        href: './favicon-32x32.png',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)

    // THEN: Browser icon should be accepted
    expect(result[0].rel).toBe('icon')
    expect(result[0].sizes).toBe('32x32')
  })

  test('should accept apple-touch-icon', () => {
    // GIVEN: Apple touch icon for iOS
    const faviconSet = [
      {
        rel: 'apple-touch-icon' as const,
        sizes: '180x180',
        href: './apple-touch-icon.png',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)

    // THEN: Apple touch icon should be accepted
    expect(result[0].rel).toBe('apple-touch-icon')
    expect(result[0].sizes).toBe('180x180')
  })

  test('should accept mask-icon with color', () => {
    // GIVEN: Safari mask icon with color
    const faviconSet = [
      {
        rel: 'mask-icon' as const,
        href: './safari-pinned-tab.svg',
        color: '#5BBAD5',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)

    // THEN: Mask icon with color should be accepted
    expect(result[0].rel).toBe('mask-icon')
    expect(result[0].color).toBe('#5BBAD5')
  })

  test('should accept manifest reference', () => {
    // GIVEN: PWA manifest reference
    const faviconSet = [
      {
        rel: 'manifest' as const,
        href: './site.webmanifest',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)

    // THEN: Manifest reference should be accepted
    expect(result[0].rel).toBe('manifest')
  })

  test('should accept complete favicon set', () => {
    // GIVEN: Complete multi-device favicon set
    const faviconSet = [
      {
        rel: 'icon' as const,
        type: 'image/png',
        sizes: '16x16',
        href: './favicon-16x16.png',
      },
      {
        rel: 'icon' as const,
        type: 'image/png',
        sizes: '32x32',
        href: './favicon-32x32.png',
      },
      {
        rel: 'apple-touch-icon' as const,
        sizes: '180x180',
        href: './apple-touch-icon.png',
      },
      {
        rel: 'mask-icon' as const,
        href: './safari-pinned-tab.svg',
        color: '#5BBAD5',
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)

    // THEN: All favicon items should be accepted
    expect(result).toHaveLength(4)
    expect(result[0].rel).toBe('icon')
    expect(result[2].rel).toBe('apple-touch-icon')
  })

  test('should reject invalid MIME type', () => {
    // GIVEN: Favicon with invalid MIME type
    const faviconSet = [
      {
        rel: 'icon' as const,
        type: 'text/html',
        href: './favicon.png',
      },
    ]

    // WHEN: Schema validation is performed
    // THEN: Should reject (MIME type must start with image/)
    expect(() => Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)).toThrow()
  })

  test('should reject invalid size format', () => {
    // GIVEN: Favicon with invalid size format
    const faviconSet = [
      {
        rel: 'icon' as const,
        sizes: '32',
        href: './favicon.png',
      },
    ]

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be WIDTHxHEIGHT format)
    expect(() => Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)).toThrow()
  })

  test('should reject invalid color format', () => {
    // GIVEN: Mask icon with invalid color
    const faviconSet = [
      {
        rel: 'mask-icon' as const,
        href: './safari-pinned-tab.svg',
        color: '#FFF',
      },
    ]

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be 6-digit hex code)
    expect(() => Schema.decodeUnknownSync(FaviconSetSchema)(faviconSet)).toThrow()
  })
})
