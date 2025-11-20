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
import { PagesSchema } from './pages'

describe('PagesSchema', () => {
  test('should accept pages array with single page', () => {
    // GIVEN: Array with one page
    const pages = [
      {
        name: 'home',
        path: '/',
        meta: {
          lang: 'en-US',
          title: 'Home',
          description: 'Homepage',
        },
        sections: [],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PagesSchema)(pages)

    // THEN: Single-page array should be accepted
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('home')
  })

  test('should accept multiple pages in array', () => {
    // GIVEN: Array with multiple pages
    const pages = [
      {
        name: 'home',
        path: '/',
        meta: {
          lang: 'en-US',
          title: 'Home',
          description: 'Homepage',
        },
        sections: [],
      },
      {
        name: 'about',
        path: '/about',
        meta: {
          lang: 'en-US',
          title: 'About',
          description: 'About us',
        },
        sections: [],
      },
      {
        name: 'pricing',
        path: '/pricing',
        meta: {
          lang: 'en-US',
          title: 'Pricing',
          description: 'Our pricing',
        },
        sections: [],
      },
      {
        name: 'contact',
        path: '/contact',
        meta: {
          lang: 'en-US',
          title: 'Contact',
          description: 'Contact us',
        },
        sections: [],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PagesSchema)(pages)

    // THEN: Multi-page array should be accepted
    expect(result).toHaveLength(4)
    expect(result[0].name).toBe('home')
    expect(result[1].name).toBe('about')
    expect(result[2].name).toBe('pricing')
    expect(result[3].name).toBe('contact')
  })

  test('should reject empty pages array', () => {
    // GIVEN: Empty pages array
    const pages = []

    // WHEN: Schema validation is performed
    // THEN: Should reject (minItems: 1)
    expect(() => Schema.decodeUnknownSync(PagesSchema)(pages)).toThrow()
  })

  test('should accept pages with different locales', () => {
    // GIVEN: Pages for different languages
    const pages = [
      {
        name: 'home_english',
        path: '/',
        meta: {
          lang: 'en',
          title: 'Welcome',
          description: 'Welcome to our platform',
        },
        sections: [],
      },
      {
        name: 'home_french',
        path: '/fr',
        meta: {
          lang: 'fr',
          title: 'Bienvenue',
          description: 'Bienvenue sur notre plateforme',
        },
        sections: [],
      },
      {
        name: 'home_spanish',
        path: '/es',
        meta: {
          lang: 'es',
          title: 'Bienvenido',
          description: 'Bienvenido a nuestra plataforma',
        },
        sections: [],
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PagesSchema)(pages)

    // THEN: Multi-locale pages should be accepted
    expect(result).toHaveLength(3)
    expect(result[0].meta.lang).toBe('en')
    expect(result[1].meta.lang).toBe('fr')
    expect(result[2].meta.lang).toBe('es')
  })

  test('should accept pages with mixed configurations', () => {
    // GIVEN: Pages with different configurations
    const pages = [
      {
        name: 'home',
        path: '/',
        meta: {
          lang: 'en-US',
          title: 'Home',
          description: 'Homepage',
        },
        sections: [],
      },
      {
        id: 'about-page',
        name: 'about',
        path: '/about',
        meta: {
          lang: 'en-US',
          title: 'About',
          description: 'About us',
        },
        layout: {
          navigation: {
            logo: './logo.svg',
            links: {
              desktop: [],
            },
          },
        },
        sections: [],
      },
      {
        name: 'contact',
        path: '/contact',
        meta: {
          lang: 'en-US',
          title: 'Contact',
          description: 'Contact us',
        },
        sections: [],
        scripts: {
          features: {
            analytics: true,
          },
        },
      },
    ]

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PagesSchema)(pages)

    // THEN: Mixed configurations should be accepted
    expect(result).toHaveLength(3)
    expect(result[0].id).toBeUndefined()
    expect(result[1].id).toBe('about-page')
    expect(result[1].layout).toBeDefined()
    expect(result[2].scripts).toBeDefined()
  })
})
