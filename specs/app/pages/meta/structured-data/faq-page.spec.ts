/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for FAQ Page Schema
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('FAQ Page Schema', () => {
  test(
    'APP-PAGES-FAQPAGE-001: should validate minimal FAQPage structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage with required properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                faqPage: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org', @type is 'FAQPage', and mainEntity is provided
      await page.goto('/')

      // THEN: it should validate minimal FAQPage structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"FAQPage"')
    }
  )

  test(
    'APP-PAGES-FAQPAGE-002: should contain list of Q&A pairs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage with mainEntity array
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'What is the refund policy?',
                      acceptedAnswer: { '@type': 'Answer', text: 'We offer 30-day returns' },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: mainEntity is array of Question objects
      await page.goto('/')

      // THEN: it should contain list of Q&A pairs
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('mainEntity')
    }
  )

  test(
    'APP-PAGES-FAQPAGE-003: should define question structure',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage with Question
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'What is the refund policy?',
                      acceptedAnswer: { '@type': 'Answer', text: 'We offer 30-day returns' },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: each item has @type 'Question', name, and acceptedAnswer
      await page.goto('/')

      // THEN: it should define question structure
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Question"')
      expect(scriptContent).toContain('name')
      expect(scriptContent).toContain('acceptedAnswer')
    }
  )

  test(
    'APP-PAGES-FAQPAGE-004: should provide question text',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage with Question name
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'What is the refund policy?',
                      acceptedAnswer: { '@type': 'Answer', text: 'Answer text' },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name is 'What is the refund policy?'
      await page.goto('/')

      // THEN: it should provide question text
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('What is the refund policy?')
    }
  )

  test(
    'APP-PAGES-FAQPAGE-005: should provide answer structure',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage with acceptedAnswer
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'Test question?',
                      acceptedAnswer: { '@type': 'Answer', text: 'Test answer' },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: acceptedAnswer has @type 'Answer' and text
      await page.goto('/')

      // THEN: it should provide answer structure
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Answer"')
      expect(scriptContent).toContain('text')
    }
  )

  test(
    'APP-PAGES-FAQPAGE-006: should provide answer content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage with Answer text
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'Question?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'We offer a 30-day money-back guarantee',
                      },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: text is 'We offer a 30-day money-back guarantee'
      await page.goto('/')

      // THEN: it should provide answer content
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('30-day money-back guarantee')
    }
  )

  test(
    'APP-PAGES-FAQPAGE-007: should support comprehensive FAQ section',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage with multiple Q&A pairs
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'Q1?',
                      acceptedAnswer: { '@type': 'Answer', text: 'A1' },
                    },
                    {
                      '@type': 'Question',
                      name: 'Q2?',
                      acceptedAnswer: { '@type': 'Answer', text: 'A2' },
                    },
                    {
                      '@type': 'Question',
                      name: 'Q3?',
                      acceptedAnswer: { '@type': 'Answer', text: 'A3' },
                    },
                    {
                      '@type': 'Question',
                      name: 'Q4?',
                      acceptedAnswer: { '@type': 'Answer', text: 'A4' },
                    },
                    {
                      '@type': 'Question',
                      name: 'Q5?',
                      acceptedAnswer: { '@type': 'Answer', text: 'A5' },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: mainEntity has 5+ Question objects
      await page.goto('/')

      // THEN: it should support comprehensive FAQ section
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      const questionCount = (scriptContent?.match(/"@type":"Question"/g) || []).length
      expect(questionCount).toBeGreaterThanOrEqual(5)
    }
  )

  test(
    'APP-PAGES-FAQPAGE-008: should display expandable Q&A in Google search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage for rich results
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'How do I return an item?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Visit our returns page and follow the instructions',
                      },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: FAQPage structured data is included in page metadata
      await page.goto('/')

      // THEN: it should display expandable Q&A in Google search results
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAQPAGE-009: should reduce support load by surfacing answers in search',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage for support content
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'Common support question?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Detailed answer to reduce support tickets',
                      },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: FAQ answers common customer questions
      await page.goto('/')

      // THEN: it should reduce support load by surfacing answers in search
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-FAQPAGE-010: should increase click-through rate from search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: FAQPage for SERP visibility
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
              schema: {
                faqPage: {
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'Why choose us?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'We offer the best service in the industry',
                      },
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: FAQ rich results show in search
      await page.goto('/')

      // THEN: it should increase click-through rate from search results
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('FAQPage')
    }
  )

  test(
    'APP-PAGES-FAQPAGE-011: user can complete full FAQ Page workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('Setup: Start server with FAQPage schema', async () => {
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
                schema: {
                  faqPage: {
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: [
                      {
                        '@type': 'Question',
                        name: 'What is the refund policy?',
                        acceptedAnswer: {
                          '@type': 'Answer',
                          text: 'We offer a 30-day money-back guarantee on all purchases',
                        },
                      },
                      {
                        '@type': 'Question',
                        name: 'How long is shipping?',
                        acceptedAnswer: {
                          '@type': 'Answer',
                          text: 'Standard shipping takes 5-7 business days',
                        },
                      },
                      {
                        '@type': 'Question',
                        name: 'Do you ship internationally?',
                        acceptedAnswer: {
                          '@type': 'Answer',
                          text: 'Yes, we ship to over 100 countries worldwide',
                        },
                      },
                    ],
                  },
                },
              },
              sections: [],
            },
          ],
        })
      })

      let jsonLd: any
      let scriptContent: string | null

      await test.step('Navigate to page and parse JSON-LD', async () => {
        await page.goto('/')
        scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        jsonLd = JSON.parse(scriptContent!)
      })

      await test.step('Verify FAQPage structure', async () => {
        expect(jsonLd).toHaveProperty('@context', 'https://schema.org')
        expect(jsonLd).toHaveProperty('@type', 'FAQPage')
        expect(jsonLd).toHaveProperty('mainEntity')
        expect(Array.isArray(jsonLd.mainEntity)).toBe(true)
        expect(jsonLd.mainEntity).toHaveLength(3)

        // Validate Question 1: Refund policy
        expect(jsonLd.mainEntity[0]).toMatchObject({
          '@type': 'Question',
          name: 'What is the refund policy?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We offer a 30-day money-back guarantee on all purchases',
          },
        })

        // Validate Question 2: Shipping time
        expect(jsonLd.mainEntity[1]).toMatchObject({
          '@type': 'Question',
          name: 'How long is shipping?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Standard shipping takes 5-7 business days',
          },
        })

        // Validate Question 3: International shipping
        expect(jsonLd.mainEntity[2]).toMatchObject({
          '@type': 'Question',
          name: 'Do you ship internationally?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, we ship to over 100 countries worldwide',
          },
        })

        // Backwards compatibility: string containment checks
        expect(scriptContent).toContain('"@type":"FAQPage"')
        expect(scriptContent).toContain('refund policy')
        expect(scriptContent).toContain('shipping')
      })
    }
  )
})
