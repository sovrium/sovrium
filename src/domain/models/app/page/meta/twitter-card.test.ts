/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { TwitterCardSchema } from './twitter-card'

describe('TwitterCardSchema', () => {
  test('should accept minimal Twitter Card with required card type', () => {
    // GIVEN: Twitter Card with only card type
    const twitterCard = {
      card: 'summary_large_image' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: Minimal card should be accepted
    expect(result.card).toBe('summary_large_image')
  })

  test('should accept all 4 Twitter Card types', () => {
    // GIVEN: All card types
    const cardTypes = ['summary', 'summary_large_image', 'app', 'player'] as const

    cardTypes.forEach((card) => {
      const twitterCard = { card }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

      // THEN: Card type should be accepted
      expect(result.card).toBe(card)
    })
  })

  test('should enforce title maxLength of 70 characters', () => {
    // GIVEN: Title with exactly 70 characters
    const twitterCard = {
      card: 'summary_large_image' as const,
      title: 'A'.repeat(70),
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: 70-character title should be accepted
    expect(result.title?.length).toBe(70)
  })

  test('should reject title exceeding 70 characters', () => {
    // GIVEN: Title with 71 characters
    const twitterCard = {
      card: 'summary' as const,
      title: 'A'.repeat(71),
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (title too long for Twitter)
    expect(() => Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)).toThrow()
  })

  test('should enforce imageAlt maxLength of 420 characters', () => {
    // GIVEN: Image alt text with exactly 420 characters
    const twitterCard = {
      card: 'summary_large_image' as const,
      imageAlt: 'B'.repeat(420),
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: 420-character alt text should be accepted
    expect(result.imageAlt?.length).toBe(420)
  })

  test('should accept valid Twitter username with @', () => {
    // GIVEN: Twitter username starting with @
    const twitterCard = {
      card: 'summary_large_image' as const,
      site: '@acmeblog',
      creator: '@johndoe',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: Twitter usernames should be accepted
    expect(result.site).toBe('@acmeblog')
    expect(result.creator).toBe('@johndoe')
  })

  test('should reject Twitter username without @', () => {
    // GIVEN: Username without @ prefix
    const twitterCard = {
      card: 'summary' as const,
      site: 'acmeblog',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (must start with @)
    expect(() => Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)).toThrow()
  })

  test('should reject Twitter username with hyphen', () => {
    // GIVEN: Username with hyphen (not allowed)
    const twitterCard = {
      card: 'summary' as const,
      site: '@my-site',
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (only letters, numbers, underscores)
    expect(() => Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)).toThrow()
  })

  test('should accept summary card with all properties', () => {
    // GIVEN: Summary card (small square image)
    const twitterCard = {
      card: 'summary' as const,
      title: 'Quick Update',
      description: 'Brief news or update',
      image: 'https://example.com/image-144x144.jpg',
      imageAlt: 'Square thumbnail image',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: Summary card should be accepted
    expect(result.card).toBe('summary')
    expect(result.title).toBe('Quick Update')
  })

  test('should accept summary_large_image card', () => {
    // GIVEN: Large image card (most popular)
    const twitterCard = {
      card: 'summary_large_image' as const,
      title: 'Major Product Launch',
      description: 'Revolutionary new product',
      image: 'https://example.com/twitter-800x418.jpg',
      imageAlt: 'Product promotional image',
      site: '@acmeanalytics',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: Large image card should be accepted
    expect(result.card).toBe('summary_large_image')
    expect(result.image).toContain('800x418')
  })

  test('should accept app card with app metadata', () => {
    // GIVEN: App card for mobile app promotion
    const twitterCard = {
      card: 'app' as const,
      title: 'Download Our Mobile App',
      description: 'Best experience on mobile',
      appName: {
        iPhone: 'MyApp',
        iPad: 'MyApp for iPad',
        googlePlay: 'MyApp',
      },
      appId: {
        iPhone: '123456789',
        iPad: '123456789',
        googlePlay: 'com.example.myapp',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: App card with metadata should be accepted
    expect(result.card).toBe('app')
    expect(result.appName?.iPhone).toBe('MyApp')
    expect(result.appId?.googlePlay).toBe('com.example.myapp')
  })

  test('should accept player card with player URL and dimensions', () => {
    // GIVEN: Player card for video/audio
    const twitterCard = {
      card: 'player' as const,
      title: 'Product Demo Video',
      description: 'Watch our product in action',
      image: 'https://example.com/video-thumbnail.jpg',
      player: 'https://example.com/player.html',
      playerWidth: 1280,
      playerHeight: 720,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: Player card should be accepted
    expect(result.card).toBe('player')
    expect(result.player).toBe('https://example.com/player.html')
    expect(result.playerWidth).toBe(1280)
    expect(result.playerHeight).toBe(720)
  })

  test('should accept complete Twitter Card configuration', () => {
    // GIVEN: Complete Twitter Card with all properties
    const twitterCard = {
      card: 'summary_large_image' as const,
      title: 'Transform Your Business with AI-Powered Analytics',
      description: 'Get real-time insights and automated reporting.',
      image: 'https://example.com/twitter-800x418.jpg',
      imageAlt: 'Dashboard screenshot showing analytics graphs',
      site: '@acmeanalytics',
      creator: '@johndoe',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TwitterCardSchema)(twitterCard)

    // THEN: Complete configuration should be accepted
    expect(result.card).toBe('summary_large_image')
    expect(result.title).toContain('Transform')
    expect(result.site).toBe('@acmeanalytics')
    expect(result.creator).toBe('@johndoe')
  })
})
