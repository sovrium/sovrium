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
import { MetaSchema } from '.'

describe('MetaSchema', () => {
  test('should accept minimal meta with required properties', () => {
    // GIVEN: Minimal meta with lang, title, description
    const meta = {
      lang: 'en-US',
      title: 'My Page Title',
      description: 'My page description for SEO',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Minimal meta should be accepted
    expect(result.lang).toBe('en-US')
    expect(result.title).toBe('My Page Title')
    expect(result.description).toBe('My page description for SEO')
  })

  test('should accept valid language codes', () => {
    // GIVEN: Various valid language codes
    const langCodes = ['en', 'en-US', 'fr', 'fr-FR', 'es-ES', 'de-DE', 'ja', 'ja-JP']

    langCodes.forEach((lang) => {
      const meta = {
        lang,
        title: 'Title',
        description: 'Description',
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(MetaSchema)(meta)

      // THEN: Language code should be accepted
      expect(result.lang).toBe(lang)
    })
  })

  test('should reject invalid language code format', () => {
    // GIVEN: Invalid language code (3 letters)
    const meta = {
      lang: 'eng',
      title: 'Title',
      description: 'Description',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be 2 letters, optional country)
    expect(() => Schema.decodeUnknownSync(MetaSchema)(meta)).toThrow()
  })

  test('should enforce title maxLength of 60 characters', () => {
    // GIVEN: Title with exactly 60 characters
    const meta = {
      lang: 'en-US',
      title: 'A'.repeat(60),
      description: 'Description',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: 60-character title should be accepted
    expect(result.title.length).toBe(60)
  })

  test('should reject title exceeding 60 characters', () => {
    // GIVEN: Title with 61 characters
    const meta = {
      lang: 'en-US',
      title: 'A'.repeat(61),
      description: 'Description',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (too long for optimal SEO)
    expect(() => Schema.decodeUnknownSync(MetaSchema)(meta)).toThrow()
  })

  test('should enforce description maxLength of 160 characters', () => {
    // GIVEN: Description with exactly 160 characters
    const meta = {
      lang: 'en-US',
      title: 'Title',
      description: 'B'.repeat(160),
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: 160-character description should be accepted
    expect(result.description.length).toBe(160)
  })

  test('should reject description exceeding 160 characters', () => {
    // GIVEN: Description with 161 characters
    const meta = {
      lang: 'en-US',
      title: 'Title',
      description: 'B'.repeat(161),
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (too long for SEO snippets)
    expect(() => Schema.decodeUnknownSync(MetaSchema)(meta)).toThrow()
  })

  test('should accept meta with SEO properties', () => {
    // GIVEN: Meta with keywords, author, canonical
    const meta = {
      lang: 'en-US',
      title: 'My Page',
      description: 'Page description',
      keywords: 'seo, metadata, web development',
      author: 'John Doe',
      canonical: 'https://example.com/my-page',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: SEO properties should be accepted
    expect(result.keywords).toBe('seo, metadata, web development')
    expect(result.author).toBe('John Doe')
    expect(result.canonical).toBe('https://example.com/my-page')
  })

  test('should accept meta with resource paths', () => {
    // GIVEN: Meta with favicon, stylesheet, fonts
    const meta = {
      lang: 'en-US',
      title: 'My Page',
      description: 'Page description',
      favicon: './favicon.ico',
      stylesheet: './output.css',
      googleFonts: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
      socialImage: 'https://example.com/social-image.jpg',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Resource paths should be accepted
    expect(result.favicon).toBe('./favicon.ico')
    expect(result.stylesheet).toBe('./output.css')
    expect(result.googleFonts).toContain('fonts.googleapis.com')
  })

  test('should accept meta with Open Graph', () => {
    // GIVEN: Meta with Open Graph for social sharing
    const meta = {
      lang: 'en-US',
      title: 'My Page',
      description: 'Page description',
      openGraph: {
        title: 'My Page Title for Facebook',
        description: 'My page description for social media',
        type: 'website' as const,
        url: 'https://example.com',
        image: 'https://example.com/og-image.jpg',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Open Graph should be accepted
    expect(result.openGraph?.type).toBe('website')
    expect(result.openGraph?.title).toBe('My Page Title for Facebook')
  })

  test('should accept meta with Twitter Card', () => {
    // GIVEN: Meta with Twitter Card
    const meta = {
      lang: 'en-US',
      title: 'My Page',
      description: 'Page description',
      twitter: {
        card: 'summary_large_image' as const,
        title: 'My Page Title for Twitter',
        image: 'https://example.com/twitter-image.jpg',
        site: '@mysite',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Twitter Card should be accepted
    expect(result.twitter?.card).toBe('summary_large_image')
    expect(result.twitter?.site).toBe('@mysite')
  })

  test('should accept meta with structured data', () => {
    // GIVEN: Meta with Schema.org structured data
    const meta = {
      lang: 'en-US',
      title: 'My Company',
      description: 'Company description',
      schema: {
        organization: {
          '@context': 'https://schema.org' as const,
          '@type': 'Organization' as const,
          name: 'Acme Inc',
          url: 'https://acme.com',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Structured data should be accepted
    expect(result.schema?.organization?.['@type']).toBe('Organization')
    expect(result.schema?.organization?.name).toBe('Acme Inc')
  })

  test('should accept meta with performance hints', () => {
    // GIVEN: Meta with preload and DNS prefetch
    const meta = {
      lang: 'en-US',
      title: 'My Page',
      description: 'Page description',
      preload: [
        {
          href: './output.css',
          as: 'style' as const,
        },
        {
          href: './fonts/Inter.woff2',
          as: 'font' as const,
          type: 'font/woff2',
          crossorigin: true,
        },
      ],
      dnsPrefetch: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Performance hints should be accepted
    expect(result.preload).toHaveLength(2)
    expect(result.dnsPrefetch).toHaveLength(2)
  })

  test('should accept meta with analytics', () => {
    // GIVEN: Meta with analytics providers
    const meta = {
      lang: 'en-US',
      title: 'My Page',
      description: 'Page description',
      analytics: {
        providers: [
          {
            name: 'google' as const,
            enabled: true,
            config: { trackingId: 'G-XXXXXXXXXX' },
          },
        ],
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Analytics should be accepted
    expect(result.analytics?.providers).toHaveLength(1)
    expect(result.analytics?.providers[0].name).toBe('google')
  })

  test('should accept meta with custom elements', () => {
    // GIVEN: Meta with custom HTML elements
    const meta = {
      lang: 'en-US',
      title: 'My Page',
      description: 'Page description',
      customElements: [
        {
          type: 'meta' as const,
          attrs: {
            name: 'theme-color',
            content: '#FFAF00',
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Custom elements should be accepted
    expect(result.customElements).toHaveLength(1)
    expect(result.customElements?.[0].type).toBe('meta')
  })

  test('should accept complete meta configuration', () => {
    // GIVEN: Complete meta with all categories
    const meta = {
      lang: 'en-US',
      title: 'Transform Your Business with AI-Powered Analytics',
      description:
        'Get real-time insights and automated reporting with our cutting-edge AI platform. Start your free trial today and experience the future of data analytics.',
      keywords: 'ai, analytics, business intelligence, data visualization',
      author: 'Acme Analytics Team',
      canonical: 'https://example.com/products/analytics',
      favicon: './favicon.ico',
      stylesheet: './output.css',
      socialImage: 'https://example.com/social-default.jpg',
      openGraph: {
        title: 'AI-Powered Business Analytics Platform',
        description: 'Transform data into insights with advanced AI',
        type: 'website' as const,
        url: 'https://example.com/products/analytics',
        image: 'https://example.com/og-analytics.jpg',
      },
      twitter: {
        card: 'summary_large_image' as const,
        title: 'AI-Powered Analytics',
        site: '@acmeanalytics',
      },
      schema: {
        organization: {
          '@context': 'https://schema.org' as const,
          '@type': 'Organization' as const,
          name: 'Acme Analytics',
          url: 'https://example.com',
        },
      },
      dnsPrefetch: ['https://fonts.googleapis.com'],
      analytics: {
        providers: [
          {
            name: 'google' as const,
            enabled: true,
          },
        ],
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(MetaSchema)(meta)

    // THEN: Complete configuration should be accepted
    expect(result.lang).toBe('en-US')
    expect(result.title.length).toBeLessThanOrEqual(60)
    expect(result.description.length).toBeLessThanOrEqual(160)
    expect(result.openGraph?.type).toBe('website')
    expect(result.schema?.organization?.name).toBe('Acme Analytics')
  })
})
