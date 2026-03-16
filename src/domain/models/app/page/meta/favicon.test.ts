/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { FaviconSchema } from './favicon'

describe('FaviconSchema', () => {
  test('should accept .ico favicon', () => {
    // GIVEN: Favicon with .ico extension
    const favicon = './public/favicon.ico'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSchema)(favicon)

    // THEN: .ico favicon should be accepted
    expect(result).toBe('./public/favicon.ico')
  })

  test('should accept .png favicon', () => {
    // GIVEN: Favicon with .png extension
    const favicon = './favicon.png'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSchema)(favicon)

    // THEN: .png favicon should be accepted
    expect(result).toBe('./favicon.png')
  })

  test('should accept .svg favicon', () => {
    // GIVEN: Favicon with .svg extension
    const favicon = './assets/favicon.svg'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaviconSchema)(favicon)

    // THEN: .svg favicon should be accepted
    expect(result).toBe('./assets/favicon.svg')
  })

  test('should reject favicon without ./ prefix', () => {
    // GIVEN: Favicon without relative path prefix
    const favicon = 'favicon.ico'

    // WHEN: Schema validation is performed
    // THEN: Should reject (must start with ./)
    expect(() => Schema.decodeUnknownSync(FaviconSchema)(favicon)).toThrow()
  })

  test('should reject favicon with unsupported extension', () => {
    // GIVEN: Favicon with .jpg extension
    const favicon = './favicon.jpg'

    // WHEN: Schema validation is performed
    // THEN: Should reject (only .ico, .png, .svg allowed)
    expect(() => Schema.decodeUnknownSync(FaviconSchema)(favicon)).toThrow()
  })

  test('should reject absolute URL', () => {
    // GIVEN: Absolute URL instead of relative path
    const favicon = 'https://example.com/favicon.ico'

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be relative path)
    expect(() => Schema.decodeUnknownSync(FaviconSchema)(favicon)).toThrow()
  })
})
