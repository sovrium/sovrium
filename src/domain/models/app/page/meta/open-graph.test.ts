/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { OpenGraphSchema } from './open-graph'

describe('OpenGraphSchema', () => {
  test('should accept minimal Open Graph with required properties', () => {
    // GIVEN: Open Graph with required fields
    const openGraph = {
      title: 'Amazing Product Launch',
      description: 'Revolutionary new product changing the industry',
      type: 'website' as const,
      url: 'https://example.com/product',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: Minimal Open Graph should be accepted
    expect(result.title).toBe('Amazing Product Launch')
    expect(result.type).toBe('website')
  })

  test('should accept all 6 Open Graph types', () => {
    // GIVEN: Different Open Graph types
    const types = ['website', 'article', 'book', 'profile', 'video', 'music'] as const

    types.forEach((type) => {
      const openGraph = {
        title: 'Test Title',
        description: 'Test Description',
        type,
        url: 'https://example.com',
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

      // THEN: Type should be accepted
      expect(result.type).toBe(type)
    })
  })

  test('should enforce title maxLength of 90 characters', () => {
    // GIVEN: Title with exactly 90 characters
    const openGraph = {
      title: 'A'.repeat(90),
      description: 'Description',
      type: 'website' as const,
      url: 'https://example.com',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: 90-character title should be accepted
    expect(result.title?.length).toBe(90)
  })

  test('should reject title exceeding 90 characters', () => {
    // GIVEN: Title with 91 characters
    const openGraph = {
      title: 'A'.repeat(91),
      description: 'Description',
      type: 'website' as const,
      url: 'https://example.com',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (title too long)
    expect(() => Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)).toThrow()
  })

  test('should enforce description maxLength of 200 characters', () => {
    // GIVEN: Description with exactly 200 characters
    const openGraph = {
      title: 'Title',
      description: 'B'.repeat(200),
      type: 'website' as const,
      url: 'https://example.com',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: 200-character description should be accepted
    expect(result.description?.length).toBe(200)
  })

  test('should accept Open Graph with image', () => {
    // GIVEN: Open Graph with social sharing image
    const openGraph = {
      title: 'Product Launch',
      description: 'Revolutionary product',
      type: 'website' as const,
      url: 'https://example.com',
      image: 'https://example.com/og-image-1200x630.jpg',
      imageAlt: 'Product screenshot showing analytics dashboard',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: Image and imageAlt should be accepted
    expect(result.image).toBe('https://example.com/og-image-1200x630.jpg')
    expect(result.imageAlt).toBe('Product screenshot showing analytics dashboard')
  })

  test('should accept Open Graph with siteName', () => {
    // GIVEN: Open Graph with site name
    const openGraph = {
      title: '10 Ways to Boost Productivity',
      description: 'Proven strategies',
      type: 'article' as const,
      url: 'https://example.com/blog/productivity',
      siteName: 'Acme Blog',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: Site name should be accepted
    expect(result.siteName).toBe('Acme Blog')
  })

  test('should accept Open Graph with valid locale', () => {
    // GIVEN: Open Graph with locale format language_TERRITORY
    const openGraph = {
      title: 'Atelier de Consentement',
      description: 'Atelier pour apprendre à poser ses limites',
      type: 'website' as const,
      url: 'https://example.fr',
      locale: 'fr_FR',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: Locale should be accepted
    expect(result.locale).toBe('fr_FR')
  })

  test('should reject invalid locale format', () => {
    // GIVEN: Open Graph with invalid locale
    const openGraph = {
      title: 'Title',
      description: 'Description',
      type: 'website' as const,
      url: 'https://example.com',
      locale: 'en-US',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (locale must be language_TERRITORY format)
    expect(() => Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)).toThrow()
  })

  test('should accept all determiner values', () => {
    // GIVEN: All valid determiner values
    const determiners = ['a', 'an', 'the', 'auto', ''] as const

    determiners.forEach((determiner) => {
      const openGraph = {
        title: 'Ultimate Guide',
        description: 'Guide description',
        type: 'article' as const,
        url: 'https://example.com',
        determiner,
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

      // THEN: Determiner should be accepted
      expect(result.determiner).toBe(determiner)
    })
  })

  test('should accept Open Graph with video URL', () => {
    // GIVEN: Open Graph for video content
    const openGraph = {
      title: 'Product Demo Video',
      description: 'See our product in action',
      type: 'video' as const,
      url: 'https://example.com/demo',
      image: 'https://example.com/video-thumbnail.jpg',
      video: 'https://example.com/demo.mp4',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: Video URL should be accepted
    expect(result.video).toBe('https://example.com/demo.mp4')
  })

  test('should accept Open Graph with audio URL', () => {
    // GIVEN: Open Graph for audio content
    const openGraph = {
      title: 'Podcast Episode #42',
      description: 'Marketing strategies',
      type: 'music' as const,
      url: 'https://example.com/podcast/42',
      image: 'https://example.com/podcast-cover.jpg',
      audio: 'https://example.com/podcast-42.mp3',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: Audio URL should be accepted
    expect(result.audio).toBe('https://example.com/podcast-42.mp3')
  })

  test('should accept complete Open Graph configuration', () => {
    // GIVEN: Open Graph with all properties
    const openGraph = {
      title: 'Transform Your Business with AI-Powered Analytics',
      description: 'Get real-time insights and automated reporting. Start free trial.',
      type: 'website' as const,
      url: 'https://example.com/product',
      image: 'https://example.com/og-image.jpg',
      imageAlt: 'Dashboard screenshot',
      siteName: 'Acme Analytics',
      locale: 'en_US',
      determiner: 'the',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OpenGraphSchema)(openGraph)

    // THEN: Complete configuration should be accepted
    expect(result.title).toContain('Transform')
    expect(result.siteName).toBe('Acme Analytics')
    expect(result.locale).toBe('en_US')
    expect(result.determiner).toBe('the')
  })
})
