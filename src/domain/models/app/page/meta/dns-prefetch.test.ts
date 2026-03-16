/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { DnsPrefetchSchema } from './dns-prefetch'

describe('DnsPrefetchSchema', () => {
  test('should accept valid HTTPS domain', () => {
    // GIVEN: DNS prefetch with HTTPS domain
    const dnsPrefetch = ['https://fonts.googleapis.com']

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(DnsPrefetchSchema)(dnsPrefetch)

    // THEN: HTTPS domain should be accepted
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('https://fonts.googleapis.com')
  })

  test('should accept valid HTTP domain', () => {
    // GIVEN: DNS prefetch with HTTP domain
    const dnsPrefetch = ['http://example.com']

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(DnsPrefetchSchema)(dnsPrefetch)

    // THEN: HTTP domain should be accepted
    expect(result[0]).toBe('http://example.com')
  })

  test('should accept multiple domains', () => {
    // GIVEN: Multiple domains for DNS prefetch
    const dnsPrefetch = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://www.google-analytics.com',
      'https://cdn.example.com',
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(DnsPrefetchSchema)(dnsPrefetch)

    // THEN: All domains should be accepted
    expect(result).toHaveLength(4)
    expect(result[0]).toBe('https://fonts.googleapis.com')
    expect(result[3]).toBe('https://cdn.example.com')
  })

  test('should accept empty array', () => {
    // GIVEN: Empty DNS prefetch array
    const dnsPrefetch: string[] = []

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(DnsPrefetchSchema)(dnsPrefetch)

    // THEN: Empty array should be accepted
    expect(result).toHaveLength(0)
  })

  test('should reject relative URL', () => {
    // GIVEN: Relative URL (not absolute)
    const dnsPrefetch = ['./fonts/Inter.woff2']

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be absolute URL)
    expect(() => Schema.decodeUnknownSync(DnsPrefetchSchema)(dnsPrefetch)).toThrow()
  })

  test('should reject domain without protocol', () => {
    // GIVEN: Domain without http:// or https://
    const dnsPrefetch = ['fonts.googleapis.com']

    // WHEN: Schema validation is performed
    // THEN: Should reject (must start with http:// or https://)
    expect(() => Schema.decodeUnknownSync(DnsPrefetchSchema)(dnsPrefetch)).toThrow()
  })

  test('should reject invalid protocol', () => {
    // GIVEN: Domain with invalid protocol
    const dnsPrefetch = ['ftp://files.example.com']

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be http:// or https://)
    expect(() => Schema.decodeUnknownSync(DnsPrefetchSchema)(dnsPrefetch)).toThrow()
  })
})
