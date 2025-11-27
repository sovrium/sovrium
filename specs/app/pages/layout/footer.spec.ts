/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Footer Configuration
 *
 * Source: src/domain/models/app/page/layout.ts
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Footer Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-FOOTER-001: should display footer at bottom of page',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with enabled set to true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { footer: { enabled: true } },
            sections: [],
          },
        ],
      })

      // WHEN: footer should be visible (default)
      await page.goto('/')

      // THEN: it should display footer at bottom of page
      await expect(page.locator('[data-testid="footer"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-FOOTER-002: should display footer logo',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with logo
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { footer: { enabled: true, logo: './logo-footer.svg' } },
            sections: [],
          },
        ],
      })

      // WHEN: logo is './logo-footer.svg'
      await page.goto('/')

      // THEN: it should display footer logo
      await expect(page.locator('[data-testid="footer-logo"]')).toHaveAttribute(
        'src',
        './logo-footer.svg'
      )
    }
  )

  test(
    'APP-PAGES-FOOTER-003: should render company description',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with description/tagline
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: { enabled: true, description: 'Building the future of web applications' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: description is 'Building the future of web applications'
      await page.goto('/')

      // THEN: it should render company description
      await expect(page.locator('[data-testid="footer-description"]')).toContainText(
        'Building the future of web applications'
      )
    }
  )

  test(
    'APP-PAGES-FOOTER-004: should render multi-column link layout',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with columns
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                columns: [
                  {
                    title: 'Product',
                    links: [
                      { label: 'Features', href: '/features' },
                      { label: 'Pricing', href: '/pricing' },
                    ],
                  },
                  {
                    title: 'Company',
                    links: [
                      { label: 'About', href: '/about' },
                      { label: 'Blog', href: '/blog' },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: columns array contains [Product, Company]
      await page.goto('/')

      // THEN: it should render multi-column link layout
      const columns = page.locator('[data-testid^="footer-column"]')
      await expect(columns).toHaveCount(2)
      await expect(page.locator('[data-testid="footer-column-0"]')).toContainText('Product')
      await expect(page.locator('[data-testid="footer-column-1"]')).toContainText('Company')
    }
  )

  test(
    'APP-PAGES-FOOTER-005: should render column heading and link list',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer column with title and links
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                columns: [
                  {
                    title: 'Product',
                    links: [
                      { label: 'Features', href: '/features' },
                      { label: 'Pricing', href: '/pricing' },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: column has title 'Product' with links [Features, Pricing]
      await page.goto('/')

      // THEN: it should render column heading and link list
      await expect(page.locator('[data-testid="column-title"]')).toContainText('Product')
      const links = page.locator('[data-testid="column-links"] a')
      await expect(links).toHaveCount(2)
    }
  )

  test(
    'APP-PAGES-FOOTER-006: should support external link targets',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer link with target _blank
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                columns: [
                  {
                    title: 'Resources',
                    links: [
                      {
                        label: 'Documentation',
                        href: 'https://docs.external.com',
                        target: '_blank',
                      },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: link opens external site in new tab
      await page.goto('/')

      // THEN: it should support external link targets
      const link = page.locator('[data-testid="footer-link-external"]')
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  )

  test(
    'APP-PAGES-FOOTER-007: should render social media icons',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with social links
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                social: {
                  title: 'Follow Us',
                  links: [
                    { platform: 'twitter', url: 'https://twitter.com/company' },
                    { platform: 'github', url: 'https://github.com/company' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: social has links for [twitter, github]
      await page.goto('/')

      // THEN: it should render social media icons
      await expect(page.locator('[data-testid="footer-social"]')).toContainText('Follow Us')
      await expect(page.locator('[data-testid="social-twitter"]')).toHaveAttribute(
        'href',
        'https://twitter.com/company'
      )
      // THEN: assertion
      await expect(page.locator('[data-testid="social-github"]')).toHaveAttribute(
        'href',
        'https://github.com/company'
      )
    }
  )

  test(
    'APP-PAGES-FOOTER-008: should support 7 social platforms with auto icons',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer social link with platform
      const platforms = [
        'facebook',
        'twitter',
        'instagram',
        'linkedin',
        'youtube',
        'github',
        'tiktok',
      ]
      const socialLinks = platforms.map((platform) => ({
        platform: platform as
          | 'facebook'
          | 'twitter'
          | 'instagram'
          | 'linkedin'
          | 'youtube'
          | 'github'
          | 'tiktok',
        url: `https://${platform}.com/company`,
      }))
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { footer: { enabled: true, social: { links: socialLinks } } },
            sections: [],
          },
        ],
      })

      // WHEN: platform enum includes facebook, twitter, instagram, linkedin, youtube, github, tiktok
      await page.goto('/')

      // THEN: it should support 7 social platforms with auto icons
      for (const platform of platforms) {
        await expect(page.locator(`[data-testid="social-${platform}"]`)).toBeVisible()
      }
    }
  )

  test(
    'APP-PAGES-FOOTER-009: should render email subscription form',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with newsletter subscription
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                newsletter: {
                  enabled: true,
                  title: 'Subscribe to our newsletter',
                  description: 'Get the latest updates',
                  placeholder: 'Enter your email',
                  buttonText: 'Subscribe',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: newsletter.enabled is true with title and description
      await page.goto('/')

      // THEN: it should render email subscription form
      await expect(page.locator('[data-testid="newsletter-title"]')).toContainText(
        'Subscribe to our newsletter'
      )
      // THEN: assertion
      await expect(page.locator('[data-testid="newsletter-input"]')).toHaveAttribute(
        'placeholder',
        'Enter your email'
      )
      // THEN: assertion
      await expect(page.locator('[data-testid="newsletter-button"]')).toContainText('Subscribe')
    }
  )

  test(
    'APP-PAGES-FOOTER-010: should display copyright notice',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with copyright text
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: { enabled: true, copyright: '© 2024 Company Inc. All rights reserved.' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: copyright is '© 2024 Company Inc. All rights reserved.'
      await page.goto('/')

      // THEN: it should display copyright notice
      await expect(page.locator('[data-testid="footer-copyright"]')).toContainText(
        '© 2024 Company Inc. All rights reserved.'
      )
    }
  )

  test(
    'APP-PAGES-FOOTER-011: should render legal link list',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with legal links
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                copyright: '© 2024 Company',
                legal: [
                  { label: 'Privacy Policy', href: '/privacy' },
                  { label: 'Terms of Service', href: '/terms' },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: legal includes [Privacy Policy, Terms of Service]
      await page.goto('/')

      // THEN: it should render legal link list
      const legalLinks = page.locator('[data-testid="footer-legal"] a')
      await expect(legalLinks).toHaveCount(2)
      await expect(legalLinks.nth(0)).toHaveText('Privacy Policy')
      await expect(legalLinks.nth(1)).toHaveText('Terms of Service')
    }
  )

  test(
    'APP-PAGES-FOOTER-012: should not render footer',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a disabled footer
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { footer: { enabled: false } },
            sections: [],
          },
        ],
      })

      // WHEN: enabled is false
      await page.goto('/')

      // THEN: it should not render footer
      await expect(page.locator('[data-testid="footer"]')).toBeHidden()
    }
  )

  test(
    'APP-PAGES-FOOTER-013: should render comprehensive footer layout',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with all 5 sections
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                logo: './logo.svg',
                description: 'Building the future',
                columns: [{ title: 'Product', links: [{ label: 'Features', href: '/features' }] }],
                social: { links: [{ platform: 'twitter', url: 'https://twitter.com/acme' }] },
                newsletter: { enabled: true, title: 'Stay updated' },
                copyright: '© 2024 Acme Corp.',
                legal: [{ label: 'Privacy', href: '/privacy' }],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: footer includes logo, columns, social, newsletter, legal
      await page.goto('/')

      // THEN: it should render comprehensive footer layout
      await expect(page.locator('[data-testid="footer-logo"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer-description"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer-column-0"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer-social"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer-newsletter"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer-copyright"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer-legal"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-FOOTER-014: should override default platform icon',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a footer with custom social icon
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                social: {
                  links: [
                    {
                      platform: 'twitter',
                      url: 'https://twitter.com/company',
                      icon: 'custom-twitter-brand',
                    },
                    { platform: 'github', url: 'https://github.com/company' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: social link has custom icon property
      await page.goto('/')

      // THEN: it should override default platform icon
      await expect(page.locator('[data-testid="custom-icon-custom-twitter-brand"]')).toBeVisible()
      await expect(page.locator('[data-testid="default-icon-github"]')).toBeVisible()
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-FOOTER-015: user can complete full footer workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive footer
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              footer: {
                enabled: true,
                logo: './logo.svg',
                description: 'Building the future',
                columns: [
                  {
                    title: 'Product',
                    links: [
                      { label: 'Features', href: '/features' },
                      { label: 'Pricing', href: '/pricing' },
                    ],
                  },
                  { title: 'Company', links: [{ label: 'About', href: '/about' }] },
                ],
                social: {
                  title: 'Follow Us',
                  links: [
                    { platform: 'twitter', url: 'https://twitter.com/acme' },
                    { platform: 'github', url: 'https://github.com/acme' },
                  ],
                },
                newsletter: {
                  enabled: true,
                  title: 'Stay in the loop',
                  placeholder: 'your@email.com',
                  buttonText: 'Subscribe',
                },
                copyright: '© 2024 Acme Corp.',
                legal: [
                  { label: 'Privacy', href: '/privacy' },
                  { label: 'Terms', href: '/terms' },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing
      await page.goto('/')

      // Verify all footer sections
      // THEN: assertion
      await expect(page.locator('[data-testid="footer-logo"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer-column-0"]')).toContainText('Product')
      await expect(page.locator('[data-testid="footer-social"]')).toContainText('Follow Us')
      await expect(page.locator('[data-testid="newsletter-title"]')).toContainText(
        'Stay in the loop'
      )
      // THEN: assertion
      await expect(page.locator('[data-testid="footer-copyright"]')).toContainText(
        '© 2024 Acme Corp.'
      )

      // Test newsletter form
      await page.fill('[data-testid="newsletter-input"]', 'test@example.com')
      await page.click('[data-testid="newsletter-button"]')

      // Focus on workflow continuity
    }
  )
})
