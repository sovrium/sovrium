/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Twitter Card Metadata
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Twitter Card Metadata', () => {
  test(
    'APP-PAGES-TWITTER-001: should validate minimal Twitter Card configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card with required card type
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: { card: 'summary_large_image' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: card property specifies card type
      await page.goto('/')

      // THEN: it should validate minimal Twitter Card configuration
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image'
      )
    }
  )

  test(
    'APP-PAGES-TWITTER-002: should display small square image card',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card with type 'summary'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary',
                title: 'Quick Update',
                description: 'Brief news or update',
                image: 'https://example.com/image-144x144.jpg',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: card is 'summary' for default card
      await page.goto('/')

      // THEN: it should display small square image card
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary')
    }
  )

  test(
    'APP-PAGES-TWITTER-003: should display large rectangular image card',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card with type 'summary_large_image'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                title: 'Major Product Launch',
                description: 'Introducing our revolutionary new product',
                image: 'https://example.com/twitter-image-800x418.jpg',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: card is 'summary_large_image' for featured content
      await page.goto('/')

      // THEN: it should display large rectangular image card
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image'
      )
    }
  )

  test(
    'APP-PAGES-TWITTER-004: should promote mobile app downloads',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card with type 'app'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'app',
                title: 'Download Our Mobile App',
                description: 'Get the best experience on mobile',
                image: 'https://example.com/app-icon.jpg',
                appName: { iPhone: 'MyApp', iPad: 'MyApp for iPad', googlePlay: 'MyApp' },
                appId: { iPhone: '123456789', iPad: '123456789', googlePlay: 'com.example.myapp' },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: card is 'app' with appName and appId
      await page.goto('/')

      // THEN: it should promote mobile app downloads
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'app')
    }
  )

  test(
    'APP-PAGES-TWITTER-005: should embed video/audio player',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card with type 'player'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'player',
                title: 'Product Demo Video',
                description: 'Watch our product in action',
                image: 'https://example.com/video-thumbnail.jpg',
                player: 'https://example.com/player.html',
                playerWidth: 1280,
                playerHeight: 720,
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: card is 'player' with player URL and dimensions
      await page.goto('/')

      // THEN: it should embed video/audio player
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'player')
      await expect(page.locator('meta[name="twitter:player"]')).toHaveAttribute(
        'content',
        'https://example.com/player.html'
      )
    }
  )

  test(
    'APP-PAGES-TWITTER-006: should enforce title length for Twitter display',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card title with maxLength
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                title: 'Transform Your Business with AI-Powered Analytics Platform',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: title has 70 characters max
      await page.goto('/')

      // THEN: it should enforce title length for Twitter display
      const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content')
      expect(twitterTitle?.length).toBeLessThanOrEqual(70)
    }
  )

  test(
    'APP-PAGES-TWITTER-007: should enforce description length for Twitter cards',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card description with maxLength
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                description:
                  'Discover how our AI-powered platform helps businesses make data-driven decisions. Get real-time insights and automated reporting. Start your free trial today.',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: description has 200 characters max
      await page.goto('/')

      // THEN: it should enforce description length for Twitter cards
      const twitterDesc = await page
        .locator('meta[name="twitter:description"]')
        .getAttribute('content')
      // THEN: assertion
      expect(twitterDesc?.length).toBeLessThanOrEqual(200)
    }
  )

  test(
    'APP-PAGES-TWITTER-008: should provide properly sized social image',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card image with size requirements
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                title: 'Product Launch',
                description: 'Revolutionary product',
                image: 'https://example.com/twitter-800x418.jpg',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: image is min 144x144px for summary or 300x157px for large
      await page.goto('/')

      // THEN: it should provide properly sized social image
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
        'content',
        'https://example.com/twitter-800x418.jpg'
      )
    }
  )

  test(
    'APP-PAGES-TWITTER-009: should attribute content to website Twitter account',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card with site @username
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                title: '10 Ways to Boost Productivity',
                description: 'Proven strategies from experts',
                image: 'https://example.com/image.jpg',
                site: '@acmeblog',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: site is '@mysite' for website attribution
      await page.goto('/')

      // THEN: it should attribute content to website Twitter account
      const site = await page.locator('meta[name="twitter:site"]').getAttribute('content')
      expect(site).toMatch(/^@[A-Za-z0-9_]+$/)
    }
  )

  test(
    'APP-PAGES-TWITTER-010: should attribute content to author Twitter account',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card with creator @username
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                title: 'How I Built a Successful Startup',
                description: 'Lessons learned from my journey',
                image: 'https://example.com/image.jpg',
                site: '@techblog',
                creator: '@johndoe',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: creator is '@johndoe' for content author
      await page.goto('/')

      // THEN: it should attribute content to author Twitter account
      const creator = await page.locator('meta[name="twitter:creator"]').getAttribute('content')
      expect(creator).toMatch(/^@[A-Za-z0-9_]+$/)
    }
  )

  test(
    'APP-PAGES-TWITTER-011: should provide accessible image description',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card imageAlt with maxLength
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                title: 'Product Launch',
                description: 'Revolutionary product',
                image: 'https://example.com/image.jpg',
                imageAlt:
                  'Product screenshot showing dashboard with three main sections: analytics graphs displaying monthly revenue trends, user activity heatmap with peak usage times highlighted in red, and automated reporting panel with scheduled report configuration options.',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: imageAlt has 420 characters max
      await page.goto('/')

      // THEN: it should provide accessible image description
      const imageAlt = await page.locator('meta[name="twitter:image:alt"]').getAttribute('content')
      expect(imageAlt?.length).toBeLessThanOrEqual(420)
    }
  )

  test(
    'APP-PAGES-TWITTER-012: should display enhanced Twitter sharing card',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Twitter Card rich preview
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              twitter: {
                card: 'summary_large_image',
                title: 'Transform Your Business with AI-Powered Analytics',
                description:
                  'Get real-time insights, automated reporting, and predictive analytics. Start your free 14-day trial today with no credit card required.',
                image: 'https://example.com/twitter-800x418.jpg',
                imageAlt: 'Dashboard screenshot showing analytics graphs and metrics',
                site: '@acmeanalytics',
                creator: '@producthunt',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: all properties create rich card on Twitter/X
      await page.goto('/')

      // THEN: it should display enhanced Twitter sharing card
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image'
      )
      // THEN: assertion
      await expect(page.locator('meta[name="twitter:title"]')).toBeAttached()
      await expect(page.locator('meta[name="twitter:description"]')).toBeAttached()
      await expect(page.locator('meta[name="twitter:image"]')).toBeAttached()
      await expect(page.locator('meta[name="twitter:site"]')).toBeAttached()
      await expect(page.locator('meta[name="twitter:creator"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-TWITTER-REGRESSION: user can complete full Twitter Card workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // ============================================================================
      // SETUP 1: Comprehensive summary_large_image with ALL additive properties
      // Covers: 001, 003, 006, 007, 008, 009, 010, 011, 012
      // ============================================================================
      await test.step('Setup: Start server with comprehensive summary_large_image configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                twitter: {
                  // Card type (001, 003)
                  card: 'summary_large_image',
                  // Title and description (006, 007)
                  title: 'Transform Your Business with AI-Powered Analytics',
                  description:
                    'Get real-time insights, automated reporting, and predictive analytics. Start your free 14-day trial today with no credit card required.',
                  // Image properties (008, 011)
                  image: 'https://example.com/twitter-800x418.jpg',
                  imageAlt:
                    'Product screenshot showing dashboard with three main sections: analytics graphs displaying monthly revenue trends, user activity heatmap with peak usage times highlighted in red, and automated reporting panel with scheduled report configuration options.',
                  // Attribution (009, 010)
                  site: '@acmeanalytics',
                  creator: '@producthunt',
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-TWITTER-001: Validate minimal Twitter Card configuration', async () => {
        // Assertions only - card type validation
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
          'content',
          'summary_large_image'
        )
      })

      await test.step('APP-PAGES-TWITTER-003: Display large rectangular image card', async () => {
        // Assertions only - same as 001, verifying summary_large_image type
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
          'content',
          'summary_large_image'
        )
      })

      await test.step('APP-PAGES-TWITTER-006: Enforce title length for Twitter display', async () => {
        // Assertions only - title length check (70 chars max)
        const twitterTitle = await page
          .locator('meta[name="twitter:title"]')
          .getAttribute('content')
        expect(twitterTitle?.length).toBeLessThanOrEqual(70)
      })

      await test.step('APP-PAGES-TWITTER-007: Enforce description length for Twitter cards', async () => {
        // Assertions only - description length check (200 chars max)
        const twitterDesc = await page
          .locator('meta[name="twitter:description"]')
          .getAttribute('content')
        expect(twitterDesc?.length).toBeLessThanOrEqual(200)
      })

      await test.step('APP-PAGES-TWITTER-008: Provide properly sized social image', async () => {
        // Assertions only - image property
        await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
          'content',
          'https://example.com/twitter-800x418.jpg'
        )
      })

      await test.step('APP-PAGES-TWITTER-009: Attribute content to website Twitter account', async () => {
        // Assertions only - site property
        const site = await page.locator('meta[name="twitter:site"]').getAttribute('content')
        expect(site).toMatch(/^@[A-Za-z0-9_]+$/)
      })

      await test.step('APP-PAGES-TWITTER-010: Attribute content to author Twitter account', async () => {
        // Assertions only - creator property
        const creator = await page.locator('meta[name="twitter:creator"]').getAttribute('content')
        expect(creator).toMatch(/^@[A-Za-z0-9_]+$/)
      })

      await test.step('APP-PAGES-TWITTER-011: Provide accessible image description', async () => {
        // Assertions only - imageAlt property (420 chars max)
        const imageAlt = await page
          .locator('meta[name="twitter:image:alt"]')
          .getAttribute('content')
        expect(imageAlt?.length).toBeLessThanOrEqual(420)
      })

      await test.step('APP-PAGES-TWITTER-012: Display enhanced Twitter sharing card', async () => {
        // Assertions only - verify all enhanced properties are attached
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
          'content',
          'summary_large_image'
        )
        await expect(page.locator('meta[name="twitter:title"]')).toBeAttached()
        await expect(page.locator('meta[name="twitter:description"]')).toBeAttached()
        await expect(page.locator('meta[name="twitter:image"]')).toBeAttached()
        await expect(page.locator('meta[name="twitter:site"]')).toBeAttached()
        await expect(page.locator('meta[name="twitter:creator"]')).toBeAttached()
      })

      // ============================================================================
      // SETUP 2: Summary card type (small square image)
      // Covers: 002
      // ============================================================================
      await test.step('APP-PAGES-TWITTER-002: Display small square image card', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                twitter: {
                  card: 'summary',
                  title: 'Quick Update',
                  description: 'Brief news or update',
                  image: 'https://example.com/image-144x144.jpg',
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
          'content',
          'summary'
        )
      })

      // ============================================================================
      // SETUP 3: App card type for mobile app promotion
      // Covers: 004
      // ============================================================================
      await test.step('APP-PAGES-TWITTER-004: Promote mobile app downloads', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                twitter: {
                  card: 'app',
                  title: 'Download Our Mobile App',
                  description: 'Get the best experience on mobile',
                  image: 'https://example.com/app-icon.jpg',
                  appName: { iPhone: 'MyApp', iPad: 'MyApp for iPad', googlePlay: 'MyApp' },
                  appId: {
                    iPhone: '123456789',
                    iPad: '123456789',
                    googlePlay: 'com.example.myapp',
                  },
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'app')
      })

      // ============================================================================
      // SETUP 4: Player card type for video/audio
      // Covers: 005
      // ============================================================================
      await test.step('APP-PAGES-TWITTER-005: Embed video/audio player', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                twitter: {
                  card: 'player',
                  title: 'Product Demo Video',
                  description: 'Watch our product in action',
                  image: 'https://example.com/video-thumbnail.jpg',
                  player: 'https://example.com/player.html',
                  playerWidth: 1280,
                  playerHeight: 720,
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'player')
        await expect(page.locator('meta[name="twitter:player"]')).toHaveAttribute(
          'content',
          'https://example.com/player.html'
        )
      })
    }
  )
})
