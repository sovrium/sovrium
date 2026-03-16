/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  normalizeLanguageCode,
  resolveTranslation,
  resolveTranslationPattern,
  collectTranslationsForKey,
} from './translation-resolver'
import type { Languages } from '@/domain/models/app/languages'

describe('normalizeLanguageCode', () => {
  test('should return exact match when found', () => {
    const translations = { 'en-US': { hello: 'Hello' }, fr: { hello: 'Bonjour' } }
    expect(normalizeLanguageCode('en-US', translations)).toBe('en-US')
  })

  test('should fall back to base language code', () => {
    const translations = { en: { hello: 'Hello' }, fr: { hello: 'Bonjour' } }
    expect(normalizeLanguageCode('en-US', translations)).toBe('en')
  })

  test('should fall back to base language for fr-FR', () => {
    const translations = { fr: { hello: 'Bonjour' }, en: { hello: 'Hello' } }
    expect(normalizeLanguageCode('fr-FR', translations)).toBe('fr')
  })

  test('should return original when no match found', () => {
    const translations = { en: { hello: 'Hello' } }
    expect(normalizeLanguageCode('de-DE', translations)).toBe('de-DE')
  })

  test('should handle empty translations', () => {
    expect(normalizeLanguageCode('en', {})).toBe('en')
  })
})

describe('resolveTranslation', () => {
  const mockLanguages: Languages = {
    supported: [
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
    ],
    default: 'en',
    translations: {
      en: { welcome: 'Welcome', goodbye: 'Goodbye' },
      fr: { welcome: 'Bienvenue' },
    },
  }

  test('should return translation for current language', () => {
    expect(resolveTranslation('welcome', 'fr', mockLanguages)).toBe('Bienvenue')
  })

  test('should fall back to default language when key missing', () => {
    expect(resolveTranslation('goodbye', 'fr', mockLanguages)).toBe('Goodbye')
  })

  test('should return key when translation not found in any language', () => {
    expect(resolveTranslation('unknown', 'fr', mockLanguages)).toBe('unknown')
  })

  test('should return key when no languages configured', () => {
    expect(resolveTranslation('hello', 'en', undefined)).toBe('hello')
  })

  test('should return key when no translations object', () => {
    const noTranslations: Languages = {
      supported: [{ code: 'en', label: 'English' }],
      default: 'en',
    }
    expect(resolveTranslation('hello', 'en', noTranslations)).toBe('hello')
  })

  test('should normalize language code for lookup', () => {
    expect(resolveTranslation('welcome', 'fr-FR', mockLanguages)).toBe('Bienvenue')
  })

  test('should use custom fallback language', () => {
    const languagesWithFallback: Languages = {
      ...mockLanguages,
      fallback: 'fr',
    }
    // Request in German (not found), fallback to fr
    expect(resolveTranslation('welcome', 'de', languagesWithFallback)).toBe('Bienvenue')
  })
})

describe('resolveTranslationPattern', () => {
  const mockLanguages: Languages = {
    supported: [
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
    ],
    default: 'en',
    translations: {
      en: { welcome: 'Welcome' },
      fr: { welcome: 'Bienvenue' },
    },
  }

  test('should resolve $t:key pattern', () => {
    expect(resolveTranslationPattern('$t:welcome', 'fr', mockLanguages)).toBe('Bienvenue')
  })

  test('should return original text when no pattern', () => {
    expect(resolveTranslationPattern('Hello world', 'fr', mockLanguages)).toBe('Hello world')
  })

  test('should return key when translation not found', () => {
    expect(resolveTranslationPattern('$t:unknown', 'fr', mockLanguages)).toBe('unknown')
  })

  test('should handle text without $t: prefix', () => {
    expect(resolveTranslationPattern('Just regular text', 'en', mockLanguages)).toBe(
      'Just regular text'
    )
  })

  test('should handle empty languages config', () => {
    expect(resolveTranslationPattern('$t:hello', 'en', undefined)).toBe('hello')
  })
})

describe('collectTranslationsForKey', () => {
  const mockLanguages: Languages = {
    supported: [
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
      { code: 'es', label: 'Español' },
    ],
    default: 'en',
    translations: {
      en: { welcome: 'Welcome', only_en: 'Only English' },
      fr: { welcome: 'Bienvenue' },
      es: { welcome: 'Bienvenido' },
    },
  }

  test('should collect translations from all languages', () => {
    const result = collectTranslationsForKey('welcome', mockLanguages)
    expect(result).toEqual({
      en: 'Welcome',
      fr: 'Bienvenue',
      es: 'Bienvenido',
    })
  })

  test('should return only languages that have the key', () => {
    const result = collectTranslationsForKey('only_en', mockLanguages)
    expect(result).toEqual({ en: 'Only English' })
  })

  test('should return undefined when key not found in any language', () => {
    const result = collectTranslationsForKey('nonexistent', mockLanguages)
    expect(result).toBeUndefined()
  })

  test('should return undefined when no languages configured', () => {
    const result = collectTranslationsForKey('welcome', undefined)
    expect(result).toBeUndefined()
  })

  test('should return undefined when no translations object', () => {
    const noTranslations: Languages = {
      supported: [{ code: 'en', label: 'English' }],
      default: 'en',
    }
    const result = collectTranslationsForKey('welcome', noTranslations)
    expect(result).toBeUndefined()
  })
})
