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
import { PageSchema } from './index'

describe('PageSchema', () => {
  test('should accept page with required properties only', () => {
    // GIVEN: Minimal page with name, path, meta, sections
    const page = {
      name: 'home',
      path: '/',
      meta: {
        lang: 'en-US',
        title: 'Home Page',
        description: 'Welcome to our homepage',
      },
      sections: [],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Minimal page should be accepted
    expect(result.name).toBe('home')
    expect(result.path).toBe('/')
    expect(result.meta.title).toBe('Home Page')
    expect(result.sections).toEqual([])
  })

  test('should accept page with all optional properties', () => {
    // GIVEN: Complete page with id, layout, and scripts
    const page = {
      id: 'home-page',
      name: 'home',
      path: '/',
      meta: {
        lang: 'en-US',
        title: 'Welcome',
        description: 'Welcome to our platform',
      },
      layout: {
        navigation: {
          logo: '/logo.svg',
          links: {
            desktop: [
              {
                label: 'Home',
                href: '/',
              },
            ],
          },
        },
      },
      sections: [],
      scripts: {
        features: {
          analytics: true,
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Complete page should be accepted
    expect(result.id).toBe('home-page')
    expect(result.layout.navigation.logo).toBe('/logo.svg')
    expect(result.scripts.features.analytics).toBe(true)
  })

  test('should accept home path', () => {
    // GIVEN: Page with root path
    const page = {
      name: 'home',
      path: '/',
      meta: {
        lang: 'en-US',
        title: 'Home',
        description: 'Homepage',
      },
      sections: [],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Root path should be accepted
    expect(result.path).toBe('/')
  })

  test('should accept nested path', () => {
    // GIVEN: Page with nested URL path
    const page = {
      name: 'pricing',
      path: '/products/pricing',
      meta: {
        lang: 'en-US',
        title: 'Pricing',
        description: 'Product pricing',
      },
      sections: [],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Nested path should be accepted
    expect(result.path).toBe('/products/pricing')
  })

  test('should accept page with sections containing direct components', () => {
    // GIVEN: Page with direct component definitions
    const page = {
      name: 'simple',
      path: '/simple',
      meta: {
        lang: 'en-US',
        title: 'Simple Page',
        description: 'Simple page',
      },
      sections: [
        {
          type: 'section',
          props: {
            id: 'hero',
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Direct component sections should be accepted
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].type).toBe('section')
  })

  test('should accept page with layout configuration', () => {
    // GIVEN: Page with complete layout
    const page = {
      name: 'full_layout',
      path: '/full',
      meta: {
        lang: 'en-US',
        title: 'Full Layout',
        description: 'Full layout page',
      },
      layout: {
        banner: {
          enabled: true,
          message: 'New feature available!',
          variant: 'info',
        },
        navigation: {
          logo: './logo.svg',
          links: {
            desktop: [
              {
                label: 'Home',
                href: '/',
              },
            ],
          },
        },
        footer: {
          enabled: true,
          copyright: '© 2025 Company',
        },
        sidebar: {
          enabled: true,
          collapsible: true,
          defaultCollapsed: false,
          position: 'left',
        },
      },
      sections: [],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Layout configuration should be accepted
    expect(result.layout?.banner?.enabled).toBe(true)
    expect(result.layout?.navigation?.logo).toBe('./logo.svg')
    expect(result.layout?.footer?.enabled).toBe(true)
    expect(result.layout?.sidebar?.position).toBe('left')
  })

  test('should accept page with scripts configuration', () => {
    // GIVEN: Page with scripts and features
    const page = {
      name: 'interactive',
      path: '/interactive',
      meta: {
        lang: 'en-US',
        title: 'Interactive',
        description: 'Interactive page',
      },
      sections: [],
      scripts: {
        features: {
          analytics: true,
          chatWidget: true,
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Scripts configuration should be accepted
    expect(result.scripts.features.analytics).toBe(true)
    expect(result.scripts.features.chatWidget).toBe(true)
  })

  test('should accept page with comprehensive metadata', () => {
    // GIVEN: Page with SEO, social, structured data, and analytics
    const page = {
      name: 'product_page',
      path: '/product',
      meta: {
        lang: 'en-US',
        title: 'Amazing Product',
        description: 'The best product ever',
        keywords: 'product, amazing, best',
        author: 'Company',
        canonical: 'https://example.com/product',
        openGraph: {
          title: 'Amazing Product',
          description: 'The best product',
          type: 'website',
          url: 'https://example.com/product',
          image: 'https://example.com/og-image.jpg',
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Amazing Product',
          description: 'The best product',
          image: 'https://example.com/twitter-image.jpg',
          site: '@company',
        },
        analytics: {
          providers: [
            {
              name: 'google',
              enabled: true,
              config: {
                trackingId: 'G-XXXXXXXXXX',
              },
            },
          ],
        },
      },
      sections: [],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PageSchema)(page)

    // THEN: Comprehensive metadata should be accepted
    expect(result.meta.title).toBe('Amazing Product')
    expect(result.meta.openGraph.type).toBe('website')
    expect(result.meta.twitter.card).toBe('summary_large_image')
    expect(result.meta.analytics.providers[0].name).toBe('google')
  })
})
