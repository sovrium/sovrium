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
import { BreadcrumbSchema } from './breadcrumb'

describe('BreadcrumbSchema', () => {
  test('should accept breadcrumb with single item', () => {
    // GIVEN: Single breadcrumb item
    const breadcrumb = {
      '@context': 'https://schema.org' as const,
      '@type': 'BreadcrumbList' as const,
      itemListElement: [
        {
          '@type': 'ListItem' as const,
          position: 1,
          name: 'Home',
          item: 'https://example.com',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreadcrumbSchema)(breadcrumb)

    // THEN: Single breadcrumb item should be accepted
    expect(result.itemListElement).toHaveLength(1)
    expect(result.itemListElement[0].name).toBe('Home')
  })

  test('should accept 3-level breadcrumb hierarchy', () => {
    // GIVEN: 3-level breadcrumb (Home > Category > Page)
    const breadcrumb = {
      '@context': 'https://schema.org' as const,
      '@type': 'BreadcrumbList' as const,
      itemListElement: [
        {
          '@type': 'ListItem' as const,
          position: 1,
          name: 'Home',
          item: 'https://example.com',
        },
        {
          '@type': 'ListItem' as const,
          position: 2,
          name: 'Products',
          item: 'https://example.com/products',
        },
        {
          '@type': 'ListItem' as const,
          position: 3,
          name: 'Widget',
          item: 'https://example.com/products/widget',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreadcrumbSchema)(breadcrumb)

    // THEN: 3-level breadcrumb should be accepted
    expect(result.itemListElement).toHaveLength(3)
    expect(result.itemListElement[0].position).toBe(1)
    expect(result.itemListElement[1].position).toBe(2)
    expect(result.itemListElement[2].position).toBe(3)
  })

  test('should accept breadcrumb without item URLs', () => {
    // GIVEN: Breadcrumb without URLs (labels only)
    const breadcrumb = {
      '@context': 'https://schema.org' as const,
      '@type': 'BreadcrumbList' as const,
      itemListElement: [
        {
          '@type': 'ListItem' as const,
          position: 1,
          name: 'Home',
        },
        {
          '@type': 'ListItem' as const,
          position: 2,
          name: 'Products',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreadcrumbSchema)(breadcrumb)

    // THEN: Breadcrumb without URLs should be accepted
    expect(result.itemListElement).toHaveLength(2)
    expect(result.itemListElement[0].item).toBeUndefined()
  })

  test('should accept 4-level e-commerce breadcrumb', () => {
    // GIVEN: 4-level e-commerce breadcrumb
    const breadcrumb = {
      '@context': 'https://schema.org' as const,
      '@type': 'BreadcrumbList' as const,
      itemListElement: [
        {
          '@type': 'ListItem' as const,
          position: 1,
          name: 'Home',
          item: 'https://example.com',
        },
        {
          '@type': 'ListItem' as const,
          position: 2,
          name: 'Products',
          item: 'https://example.com/products',
        },
        {
          '@type': 'ListItem' as const,
          position: 3,
          name: 'Electronics',
          item: 'https://example.com/products/electronics',
        },
        {
          '@type': 'ListItem' as const,
          position: 4,
          name: 'Laptop',
          item: 'https://example.com/products/electronics/laptop',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(BreadcrumbSchema)(breadcrumb)

    // THEN: 4-level breadcrumb should be accepted
    expect(result.itemListElement).toHaveLength(4)
    expect(result.itemListElement[3].name).toBe('Laptop')
  })

  test('should reject position less than 1', () => {
    // GIVEN: Breadcrumb item with position 0
    const breadcrumb = {
      '@context': 'https://schema.org' as const,
      '@type': 'BreadcrumbList' as const,
      itemListElement: [
        {
          '@type': 'ListItem' as const,
          position: 0,
          name: 'Home',
        },
      ],
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (position must be >= 1)
    expect(() => Schema.decodeUnknownSync(BreadcrumbSchema)(breadcrumb)).toThrow()
  })

  test('should reject negative position', () => {
    // GIVEN: Breadcrumb item with negative position
    const breadcrumb = {
      '@context': 'https://schema.org' as const,
      '@type': 'BreadcrumbList' as const,
      itemListElement: [
        {
          '@type': 'ListItem' as const,
          position: -1,
          name: 'Home',
        },
      ],
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (position must be positive)
    expect(() => Schema.decodeUnknownSync(BreadcrumbSchema)(breadcrumb)).toThrow()
  })
})
