/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ArticleSchema } from './article'

describe('ArticleSchema', () => {
  test('should accept minimal article with required properties', () => {
    // GIVEN: Minimal article with only required fields
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'Article' as const,
      headline: '10 Ways to Boost Productivity',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Minimal article should be accepted
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Article')
    expect(result.headline).toBe('10 Ways to Boost Productivity')
  })

  test('should accept all 3 article types', () => {
    // GIVEN: Different article types
    const articleTypes = ['Article', 'NewsArticle', 'BlogPosting'] as const

    articleTypes.forEach((type) => {
      const article = {
        '@context': 'https://schema.org' as const,
        '@type': type,
        headline: 'Test Article',
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(ArticleSchema)(article)

      // THEN: Article type should be accepted
      expect(result['@type']).toBe(type)
    })
  })

  test('should accept article with string author', () => {
    // GIVEN: Article with simple string author
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'BlogPosting' as const,
      headline: 'React Best Practices',
      author: 'John Doe',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: String author should be accepted
    expect(result.author).toBe('John Doe')
  })

  test('should accept article with structured Person author', () => {
    // GIVEN: Article with structured Person author
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'Article' as const,
      headline: 'Advanced TypeScript Patterns',
      author: {
        '@type': 'Person' as const,
        name: 'Jane Smith',
        url: 'https://example.com/author/janesmith',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Structured Person author should be accepted
    expect(typeof result.author).toBe('object')
    if (typeof result.author === 'object') {
      expect(result.author['@type']).toBe('Person')
      expect(result.author.name).toBe('Jane Smith')
    }
  })

  test('should accept article with structured Organization author', () => {
    // GIVEN: Article with structured Organization author
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'NewsArticle' as const,
      headline: 'Breaking: Tech Company Launches New Product',
      author: {
        '@type': 'Organization' as const,
        name: 'TechNews Daily',
        url: 'https://technews.com',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Structured Organization author should be accepted
    expect(typeof result.author).toBe('object')
    if (typeof result.author === 'object') {
      expect(result.author['@type']).toBe('Organization')
    }
  })

  test('should accept article with single image', () => {
    // GIVEN: Article with single image URL
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'Article' as const,
      headline: 'The Future of Web Development',
      image: 'https://example.com/article-image.jpg',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Single image should be accepted
    expect(result.image).toBe('https://example.com/article-image.jpg')
  })

  test('should accept article with multiple images', () => {
    // GIVEN: Article with array of image URLs
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'Article' as const,
      headline: 'Photo Gallery: Conference Highlights',
      image: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
        'https://example.com/photo3.jpg',
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Multiple images should be accepted
    expect(Array.isArray(result.image)).toBe(true)
    if (Array.isArray(result.image)) {
      expect(result.image).toHaveLength(3)
    }
  })

  test('should accept article with publication dates', () => {
    // GIVEN: Article with datePublished and dateModified
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'BlogPosting' as const,
      headline: 'Getting Started with Effect',
      datePublished: '2025-01-15T10:00:00Z',
      dateModified: '2025-01-20T14:30:00Z',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Publication dates should be accepted
    expect(result.datePublished).toBe('2025-01-15T10:00:00Z')
    expect(result.dateModified).toBe('2025-01-20T14:30:00Z')
  })

  test('should accept article with publisher', () => {
    // GIVEN: Article with publisher organization
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'Article' as const,
      headline: 'Cloud Computing Trends',
      publisher: {
        '@type': 'Organization' as const,
        name: 'Acme Blog',
        logo: {
          '@type': 'ImageObject' as const,
          url: 'https://example.com/logo.png',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Publisher should be accepted
    expect(result.publisher?.['@type']).toBe('Organization')
    expect(result.publisher?.name).toBe('Acme Blog')
    expect(result.publisher?.logo?.url).toBe('https://example.com/logo.png')
  })

  test('should accept complete article configuration', () => {
    // GIVEN: Complete article with all properties
    const article = {
      '@context': 'https://schema.org' as const,
      '@type': 'BlogPosting' as const,
      headline: '10 Ways to Boost Productivity',
      description: 'Proven strategies to improve your daily productivity and achieve more.',
      image: 'https://example.com/article-image.jpg',
      author: {
        '@type': 'Person' as const,
        name: 'John Doe',
        url: 'https://example.com/author/johndoe',
      },
      datePublished: '2025-01-15T10:00:00Z',
      dateModified: '2025-01-20T14:30:00Z',
      publisher: {
        '@type': 'Organization' as const,
        name: 'Acme Blog',
        logo: {
          '@type': 'ImageObject' as const,
          url: 'https://example.com/logo.png',
        },
      },
      mainEntityOfPage: 'https://example.com/blog/productivity-tips',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ArticleSchema)(article)

    // THEN: Complete configuration should be accepted
    expect(result.headline).toBe('10 Ways to Boost Productivity')
    expect(result.description).toContain('productivity')
    expect(result.mainEntityOfPage).toBe('https://example.com/blog/productivity-tips')
  })
})
