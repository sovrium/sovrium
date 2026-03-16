/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  SchemaOrgContext,
  SchemaOrgEmail,
  SchemaOrgTelephone,
  SchemaOrgSameAs,
  SchemaOrgUrl,
  SchemaOrgImageUrl,
  optional,
} from './common-fields'

describe('SchemaOrgContext', () => {
  test('should accept valid schema.org context', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgContext)('https://schema.org')
    expect(result).toBe('https://schema.org')
  })

  test('should reject invalid context', () => {
    expect(() => Schema.decodeUnknownSync(SchemaOrgContext)('https://example.com')).toThrow()
  })

  test('should reject http context', () => {
    expect(() => Schema.decodeUnknownSync(SchemaOrgContext)('http://schema.org')).toThrow()
  })
})

describe('SchemaOrgEmail', () => {
  test('should accept valid email format', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgEmail)('test@example.com')
    expect(result).toBe('test@example.com')
  })

  test('should accept email with subdomain', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgEmail)('user@mail.example.com')
    expect(result).toBe('user@mail.example.com')
  })
})

describe('SchemaOrgTelephone', () => {
  test('should accept phone number string', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgTelephone)('+1-555-123-4567')
    expect(result).toBe('+1-555-123-4567')
  })

  test('should accept various phone formats', () => {
    const formats = ['+1 555 123 4567', '(555) 123-4567', '555-123-4567', '+33 1 23 45 67 89']
    for (const phone of formats) {
      const result = Schema.decodeUnknownSync(SchemaOrgTelephone)(phone)
      expect(result).toBe(phone)
    }
  })
})

describe('SchemaOrgSameAs', () => {
  test('should accept array of social URLs', () => {
    const urls = ['https://twitter.com/example', 'https://linkedin.com/in/example']
    const result = Schema.decodeUnknownSync(SchemaOrgSameAs)(urls)
    expect(result).toEqual(urls)
  })

  test('should accept empty array', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgSameAs)([])
    expect(result).toEqual([])
  })

  test('should accept single URL', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgSameAs)(['https://github.com/example'])
    expect(result).toEqual(['https://github.com/example'])
  })
})

describe('SchemaOrgUrl', () => {
  test('should accept valid URL', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgUrl)('https://example.com')
    expect(result).toBe('https://example.com')
  })

  test('should accept URL with path', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgUrl)('https://example.com/path/to/page')
    expect(result).toBe('https://example.com/path/to/page')
  })
})

describe('SchemaOrgImageUrl', () => {
  test('should accept image URL', () => {
    const result = Schema.decodeUnknownSync(SchemaOrgImageUrl)('https://example.com/image.jpg')
    expect(result).toBe('https://example.com/image.jpg')
  })

  test('should accept various image formats', () => {
    const images = [
      'https://example.com/photo.png',
      'https://example.com/logo.webp',
      'https://cdn.example.com/assets/banner.jpeg',
    ]
    for (const img of images) {
      const result = Schema.decodeUnknownSync(SchemaOrgImageUrl)(img)
      expect(result).toBe(img)
    }
  })
})

describe('optional helper', () => {
  test('should make schema optional', () => {
    const OptionalEmail = optional(SchemaOrgEmail)
    const result = Schema.decodeUnknownSync(Schema.Struct({ email: OptionalEmail }))({})
    expect(result).toEqual({})
  })

  test('should allow value when present', () => {
    const OptionalEmail = optional(SchemaOrgEmail)
    const result = Schema.decodeUnknownSync(Schema.Struct({ email: OptionalEmail }))({
      email: 'test@example.com',
    })
    expect(result).toEqual({ email: 'test@example.com' })
  })
})
