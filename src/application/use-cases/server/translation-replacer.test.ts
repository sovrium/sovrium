/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { replacePageTokens, replaceAppTokens } from './translation-replacer'
import type { App, Page } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages'

describe('replacePageTokens', () => {
  const mockLanguages: Languages = {
    supported: [
      { code: 'en', locale: 'en-US', label: 'English' },
      { code: 'fr', locale: 'fr-FR', label: 'Français' },
    ],
    default: 'en',
    translations: {
      en: { welcome: 'Welcome', title: 'Home Page' },
      fr: { welcome: 'Bienvenue', title: "Page d'accueil" },
    },
  }

  test('should replace $t: token in page meta title', () => {
    const page: Page = {
      name: 'home',
      path: '/',
      meta: { title: '$t:title' },
      sections: [],
    }

    const context = {
      langCode: 'fr',
      langConfig: { code: 'fr', locale: 'fr-FR', label: 'Français' },
      languages: mockLanguages,
      translations: mockLanguages.translations!['fr'] as Record<string, string>,
    }

    const result = replacePageTokens(page, context)

    expect(result.meta?.title).toBe("Page d'accueil")
  })

  test('should set meta.lang to locale', () => {
    const page: Page = {
      name: 'home',
      path: '/',
      meta: { title: 'Test' },
      sections: [],
    }

    const context = {
      langCode: 'fr',
      langConfig: { code: 'fr', locale: 'fr-FR', label: 'Français' },
      languages: mockLanguages,
      translations: {},
    }

    const result = replacePageTokens(page, context)

    expect(result.meta?.lang).toBe('fr-FR')
  })

  test('should replace {{currentPath}} token', () => {
    const page: Page = {
      name: 'about',
      path: '/about',
      meta: { title: 'About' },
      sections: [
        {
          type: 'navigation',
          items: [{ href: '/en{{currentPath}}', label: 'English' }],
        },
      ],
    }

    const context = {
      langCode: 'en',
      langConfig: { code: 'en', locale: 'en-US', label: 'English' },
      languages: mockLanguages,
      translations: {},
    }

    const result = replacePageTokens(page, context)
    const section = result.sections?.[0] as { items: Array<{ href: string }> }

    expect(section.items[0]!.href).toBe('/en/about')
  })

  test('should handle page without meta', () => {
    const page: Page = {
      name: 'home',
      path: '/',
      sections: [],
    }

    const context = {
      langCode: 'en',
      langConfig: { code: 'en', locale: 'en-US', label: 'English' },
      languages: mockLanguages,
      translations: {},
    }

    const result = replacePageTokens(page, context)

    expect(result.path).toBe('/')
    expect(result.meta).toBeUndefined()
  })

  test('should fall back to default language for missing translations', () => {
    const page: Page = {
      name: 'home',
      path: '/',
      meta: { title: '$t:welcome' },
      sections: [],
    }

    const context = {
      langCode: 'de', // German - not in translations
      langConfig: { code: 'de', locale: 'de-DE', label: 'Deutsch' },
      languages: mockLanguages,
      translations: {},
    }

    const result = replacePageTokens(page, context)

    // Falls back to default language (en)
    expect(result.meta?.title).toBe('Welcome')
  })
})

describe('replaceAppTokens', () => {
  const mockApp: App = {
    name: 'test-app',
    languages: {
      supported: [
        { code: 'en', locale: 'en-US', label: 'English' },
        { code: 'fr', locale: 'fr-FR', label: 'Français' },
      ],
      default: 'en',
      translations: {
        en: { welcome: 'Welcome', title: 'Home' },
        fr: { welcome: 'Bienvenue', title: 'Accueil' },
      },
    },
    pages: [
      {
        name: 'home',
        path: '/',
        meta: { title: '$t:title' },
        sections: [],
      },
    ],
  }

  test('should replace tokens in all pages for specified language', () => {
    const result = replaceAppTokens(mockApp, 'fr')

    expect(result.pages?.[0]!.meta?.title).toBe('Accueil')
  })

  test('should return app unchanged if no languages configured', () => {
    const appWithoutLanguages: App = {
      name: 'test-app',
      pages: [{ name: 'home', path: '/', meta: { title: '$t:title' }, sections: [] }],
    }

    const result = replaceAppTokens(appWithoutLanguages, 'en')

    expect(result).toBe(appWithoutLanguages)
    expect(result.pages?.[0]!.meta?.title).toBe('$t:title') // Unchanged
  })

  test('should preserve {{currentPath}} in defaultLayout', () => {
    const appWithLayout: App = {
      ...mockApp,
      defaultLayout: {
        navigation: {
          logo: './logo.svg',
          links: {
            desktop: [{ href: '/en{{currentPath}}', label: '$t:welcome' }],
          },
        },
      },
    }

    const result = replaceAppTokens(appWithLayout, 'fr')

    const layout = result.defaultLayout as unknown as {
      navigation: { links: { desktop: ReadonlyArray<{ href: string; label: string }> } }
    }
    // Translation should be replaced
    expect(layout.navigation.links.desktop[0]!.label).toBe('Bienvenue')
    // {{currentPath}} should be preserved for per-page resolution
    expect(layout.navigation.links.desktop[0]!.href).toBe('/en{{currentPath}}')
  })

  test('should handle app without pages', () => {
    const appWithoutPages: App = {
      name: 'test-app',
      languages: mockApp.languages,
    }

    const result = replaceAppTokens(appWithoutPages, 'en')

    expect(result.pages).toBeUndefined()
  })

  test('should handle nested objects in page sections', () => {
    const appWithNestedSections: App = {
      ...mockApp,
      pages: [
        {
          name: 'home',
          path: '/',
          sections: [
            {
              type: 'hero',
              content: {
                title: '$t:welcome',
                nested: {
                  subtitle: '$t:title',
                },
              },
            },
          ],
        },
      ],
    }

    const result = replaceAppTokens(appWithNestedSections, 'fr')
    const section = result.pages?.[0]!.sections?.[0] as {
      content: { title: string; nested: { subtitle: string } }
    }

    expect(section.content.title).toBe('Bienvenue')
    expect(section.content.nested.subtitle).toBe('Accueil')
  })

  test('should handle arrays in page sections', () => {
    const appWithArrays: App = {
      ...mockApp,
      pages: [
        {
          name: 'home',
          path: '/',
          sections: [
            {
              type: 'list',
              items: ['$t:welcome', '$t:title', 'Static text'],
            },
          ],
        },
      ],
    }

    const result = replaceAppTokens(appWithArrays, 'fr')
    const section = result.pages?.[0]!.sections?.[0] as { items: string[] }

    expect(section.items).toEqual(['Bienvenue', 'Accueil', 'Static text'])
  })
})
