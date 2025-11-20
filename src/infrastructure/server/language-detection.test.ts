/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  getSupportedLanguageCodes,
  extractLanguageFromPath,
  detectLanguageIfEnabled,
  validateLanguageSubdirectory,
} from './language-detection'
import type { App } from '@/domain/models/app'

describe('Language Detection', () => {
  describe('getSupportedLanguageCodes', () => {
    test('returns array of language codes from app', () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'French' },
            { code: 'es', locale: 'es-ES', label: 'Spanish' },
          ] as const,
        },
        pages: [],
      }

      const codes = getSupportedLanguageCodes(app)

      expect(codes).toEqual(['en', 'fr', 'es'])
    })

    test('returns empty array when languages not configured', () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        pages: [],
      }

      const codes = getSupportedLanguageCodes(app)

      expect(codes).toEqual([])
    })

    test('returns array with single language', () => {
      const app: App = {
        name: 'Test App',
        description: 'Test',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English' }] as const,
        },
        pages: [],
      }

      const codes = getSupportedLanguageCodes(app)

      expect(codes).toEqual(['en'])
    })
  })

  describe('extractLanguageFromPath', () => {
    const supportedLanguages = ['en', 'fr', 'es']

    test('extracts language from root path with trailing slash', () => {
      const result = extractLanguageFromPath('/fr/', supportedLanguages)

      expect(result).toBe('fr')
    })

    test('extracts language from nested path', () => {
      const result = extractLanguageFromPath('/fr/about', supportedLanguages)

      expect(result).toBe('fr')
    })

    test('extracts language from deep nested path', () => {
      const result = extractLanguageFromPath('/en/products/pricing', supportedLanguages)

      expect(result).toBe('en')
    })

    test('returns undefined for root path', () => {
      const result = extractLanguageFromPath('/', supportedLanguages)

      expect(result).toBeUndefined()
    })

    test('returns undefined for unsupported language code', () => {
      const result = extractLanguageFromPath('/de/', supportedLanguages)

      expect(result).toBeUndefined()
    })

    test('returns undefined for invalid language code format', () => {
      const result = extractLanguageFromPath('/invalid/', supportedLanguages)

      expect(result).toBeUndefined()
    })

    test('returns undefined for path without language code', () => {
      const result = extractLanguageFromPath('/about', supportedLanguages)

      expect(result).toBeUndefined()
    })

    test('handles path without leading slash', () => {
      const result = extractLanguageFromPath('fr/about', supportedLanguages)

      expect(result).toBe('fr')
    })

    test('handles empty path', () => {
      const result = extractLanguageFromPath('', supportedLanguages)

      expect(result).toBeUndefined()
    })

    test('handles path with multiple slashes', () => {
      const result = extractLanguageFromPath('//fr//about//', supportedLanguages)

      expect(result).toBe('fr')
    })

    test('returns undefined for empty supported languages', () => {
      const result = extractLanguageFromPath('/en/', [])

      expect(result).toBeUndefined()
    })

    test('case-sensitive language code matching', () => {
      const result1 = extractLanguageFromPath('/en-us/', supportedLanguages)
      const result2 = extractLanguageFromPath('/EN-US/', supportedLanguages)

      expect(result1).toBeUndefined()
      expect(result2).toBeUndefined()
    })
  })

  describe('detectLanguageIfEnabled', () => {
    const app: App = {
      name: 'Test App',
      description: 'Test',
      languages: {
        default: 'en',
        supported: [
          { code: 'en', locale: 'en-US', label: 'English' },
          { code: 'fr', locale: 'fr-FR', label: 'French' },
          { code: 'es', locale: 'es-ES', label: 'Spanish' },
        ] as const,
      },
      pages: [],
    }

    test('detects language from Accept-Language header when enabled', () => {
      const result = detectLanguageIfEnabled(app, 'fr,fr;q=0.9,en;q=0.8')

      expect(result).toBe('fr')
    })

    test('returns best match from Accept-Language header', () => {
      const result = detectLanguageIfEnabled(app, 'es,es;q=0.9,en;q=0.8')

      expect(result).toBe('es')
    })

    test('returns undefined when browser detection is disabled', () => {
      const appWithDetectionDisabled: App = {
        ...app,
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'French' },
          ] as const,
          detectBrowser: false,
        },
      }

      const result = detectLanguageIfEnabled(appWithDetectionDisabled, 'fr-FR,fr;q=0.9')

      expect(result).toBeUndefined()
    })

    test('returns undefined when header is undefined', () => {
      const result = detectLanguageIfEnabled(app, undefined)

      expect(result).toBeUndefined()
    })

    test('returns undefined when header is empty', () => {
      const result = detectLanguageIfEnabled(app, '')

      expect(result).toBeUndefined()
    })

    test('returns undefined when no supported language matches', () => {
      const result = detectLanguageIfEnabled(app, 'de,de;q=0.9')

      expect(result).toBeUndefined()
    })

    test('detects language when browser detection is explicitly enabled', () => {
      const appWithDetectionEnabled: App = {
        ...app,
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'French' },
          ] as const,
          detectBrowser: true,
        },
      }

      const result = detectLanguageIfEnabled(appWithDetectionEnabled, 'fr-FR,fr;q=0.9')

      expect(result).toBe('fr')
    })

    test('detects language when detectBrowser is not specified (default enabled)', () => {
      const appWithDefaultDetection: App = {
        ...app,
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'French' },
          ] as const,
        },
      }

      const result = detectLanguageIfEnabled(appWithDefaultDetection, 'fr-FR,fr;q=0.9')

      expect(result).toBe('fr')
    })
  })

  describe('validateLanguageSubdirectory', () => {
    const app: App = {
      name: 'Test App',
      description: 'Test',
      languages: {
        default: 'en',
        supported: [
          { code: 'en', locale: 'en-US', label: 'English' },
          { code: 'fr', locale: 'fr-FR', label: 'French' },
          { code: 'es', locale: 'es-ES', label: 'Spanish' },
        ] as const,
      },
      pages: [],
    }

    test('validates and returns language code from subdirectory', () => {
      const result = validateLanguageSubdirectory(app, '/fr/')

      expect(result).toBe('fr')
    })

    test('validates language code from nested path', () => {
      const result = validateLanguageSubdirectory(app, '/fr/about')

      expect(result).toBe('fr')
    })

    test('returns undefined for path without language subdirectory', () => {
      const result = validateLanguageSubdirectory(app, '/products/pricing')

      expect(result).toBeUndefined()
    })

    test('returns undefined for unsupported language', () => {
      const result = validateLanguageSubdirectory(app, '/de-DE/')

      expect(result).toBeUndefined()
    })

    test('returns undefined for root path', () => {
      const result = validateLanguageSubdirectory(app, '/')

      expect(result).toBeUndefined()
    })

    test('validates all supported languages', () => {
      expect(validateLanguageSubdirectory(app, '/en/')).toBe('en')
      expect(validateLanguageSubdirectory(app, '/fr/')).toBe('fr')
      expect(validateLanguageSubdirectory(app, '/es/')).toBe('es')
    })

    test('returns undefined when app has no languages configured', () => {
      const appWithoutLanguages: App = {
        name: 'Test App',
        description: 'Test',
        pages: [],
      }

      const result = validateLanguageSubdirectory(appWithoutLanguages, '/en-US/')

      expect(result).toBeUndefined()
    })
  })
})
