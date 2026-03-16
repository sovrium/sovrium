/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import {
  LanguageCodeSchema,
  TranslationKeySchema,
  TranslationDictionarySchema,
  TranslationsSchema,
  LanguagesSchema,
} from './languages'

describe('LanguageCodeSchema', () => {
  test('should accept ISO 639-1 codes without region', () => {
    // GIVEN: Two-letter language codes
    const codes = ['en', 'fr', 'es', 'de', 'ja', 'ar']

    // WHEN: Schema validation is performed on each
    const results = codes.map((code) => Schema.decodeUnknownSync(LanguageCodeSchema)(code))

    // THEN: All codes should be accepted
    expect(results).toEqual(codes)
  })

  test('should reject ISO 639-1 codes with region (use LanguageConfigSchema.locale instead)', () => {
    // GIVEN: Language codes with region (these are now locale codes, not language codes)
    const codes = ['en-US', 'fr-FR', 'es-ES', 'de-DE', 'ja-JP', 'ar-SA']

    // WHEN/THEN: Schema validation should reject these
    // NOTE: Use the 'locale' field in LanguageConfigSchema for full locale codes
    codes.forEach((code) => {
      expect(() => Schema.decodeUnknownSync(LanguageCodeSchema)(code)).toThrow()
    })
  })

  test('should reject invalid language code formats', () => {
    // GIVEN: Invalid language codes
    const invalidCodes = ['EN', 'en-us', 'eng', 'en_US', 'en-USA']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidCodes.forEach((code) => {
      expect(() => Schema.decodeUnknownSync(LanguageCodeSchema)(code)).toThrow()
    })
  })
})

describe('TranslationKeySchema', () => {
  test('should accept keys with dots, hyphens, and underscores', () => {
    // GIVEN: Valid translation keys
    const keys = [
      'common.save',
      'nav.home',
      'homepage.hero.title',
      'errors.404',
      'forms.email-address',
      'auth.sign_in',
    ]

    // WHEN: Schema validation is performed on each
    const results = keys.map((key) => Schema.decodeUnknownSync(TranslationKeySchema)(key))

    // THEN: All keys should be accepted
    expect(results).toEqual(keys)
  })

  test('should reject keys with invalid characters', () => {
    // GIVEN: Invalid translation keys
    const invalidKeys = ['common save', 'nav/home', 'errors@404', 'common$save']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidKeys.forEach((key) => {
      expect(() => Schema.decodeUnknownSync(TranslationKeySchema)(key)).toThrow()
    })
  })
})

describe('TranslationDictionarySchema', () => {
  test('should accept translation dictionary with string values', () => {
    // GIVEN: Translation dictionary
    const dictionary = {
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'nav.home': 'Home',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TranslationDictionarySchema)(dictionary)

    // THEN: Dictionary should be accepted
    expect(result).toEqual(dictionary)
  })

  test('should accept empty translation dictionary', () => {
    // GIVEN: Empty dictionary
    const dictionary = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TranslationDictionarySchema)(dictionary)

    // THEN: Empty dictionary should be accepted
    expect(result).toEqual({})
  })
})

describe('TranslationsSchema', () => {
  test('should accept translations for multiple languages', () => {
    // GIVEN: Centralized translations
    const translations = {
      en: {
        'common.save': 'Save',
        'common.cancel': 'Cancel',
      },
      fr: {
        'common.save': 'Enregistrer',
        'common.cancel': 'Annuler',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TranslationsSchema)(translations)

    // THEN: All languages should be accepted
    expect(result['en']?.['common.save']).toBe('Save')
    expect(result['fr']?.['common.save']).toBe('Enregistrer')
  })

  test('should accept empty translations', () => {
    // GIVEN: Empty translations
    const translations = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(TranslationsSchema)(translations)

    // THEN: Empty translations should be accepted
    expect(result).toEqual({})
  })
})

describe('LanguagesSchema', () => {
  test('should accept minimal configuration with default and one supported language', () => {
    // GIVEN: Minimal language setup
    const languages = {
      default: 'en',
      supported: [
        {
          code: 'en',
          locale: 'en-US',
          label: 'English',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: Minimal configuration should be accepted
    expect(result.default).toBe('en')
    expect(result.supported).toHaveLength(1)
  })

  test('should accept configuration with multiple supported languages', () => {
    // GIVEN: Multi-language configuration
    const languages = {
      default: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English' },
        { code: 'fr', locale: 'fr-FR', label: 'Français' },
        { code: 'es', locale: 'es-ES', label: 'Español' },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: All languages should be accepted
    expect(result.supported).toHaveLength(3)
  })

  test('should accept configuration with fallback language', () => {
    // GIVEN: Configuration with fallback
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English' },
        { code: 'fr', locale: 'fr-FR', label: 'Français' },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: Fallback should be accepted
    expect(result.fallback).toBe('en')
  })

  test('should accept configuration with detectBrowser flag', () => {
    // GIVEN: Configuration with detectBrowser
    const languages = {
      default: 'en',
      detectBrowser: true,
      supported: [{ code: 'en', locale: 'en-US', label: 'English' }],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: detectBrowser should be accepted
    expect(result.detectBrowser).toBe(true)
  })

  test('should accept configuration with persistSelection flag', () => {
    // GIVEN: Configuration with persistSelection
    const languages = {
      default: 'en',
      persistSelection: true,
      supported: [{ code: 'en', locale: 'en-US', label: 'English' }],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: persistSelection should be accepted
    expect(result.persistSelection).toBe(true)
  })

  test('should accept configuration with centralized translations', () => {
    // GIVEN: Configuration with translations
    const languages = {
      default: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English' },
        { code: 'fr', locale: 'fr-FR', label: 'Français' },
      ],
      translations: {
        en: {
          'common.save': 'Save',
          'common.cancel': 'Cancel',
        },
        fr: {
          'common.save': 'Enregistrer',
          'common.cancel': 'Annuler',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: Translations should be accepted (keyed by short codes, not full locales)
    expect(result.translations?.['en']?.['common.save']).toBe('Save')
    expect(result.translations?.['fr']?.['common.save']).toBe('Enregistrer')
  })

  test('should accept configuration with RTL and LTR languages', () => {
    // GIVEN: Configuration with bidirectional support
    const languages = {
      default: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' },
        { code: 'ar', locale: 'ar-SA', label: 'العربية', direction: 'rtl' },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: Both directions should be accepted
    expect(result.supported[0]?.direction).toBe('ltr')
    expect(result.supported[1]?.direction).toBe('rtl')
  })

  test('should accept configuration with language flags', () => {
    // GIVEN: Configuration with flag emojis
    const languages = {
      default: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', flag: '🇺🇸' },
        { code: 'fr', locale: 'fr-FR', label: 'Français', flag: '🇫🇷' },
        { code: 'ja', locale: 'ja-JP', label: '日本語', flag: '🇯🇵' },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: All flags should be accepted
    expect(result.supported[0]?.flag).toBe('🇺🇸')
    expect(result.supported[1]?.flag).toBe('🇫🇷')
    expect(result.supported[2]?.flag).toBe('🇯🇵')
  })

  test('should accept configuration with all features enabled', () => {
    // GIVEN: Complete language configuration
    const languages = {
      default: 'en',
      fallback: 'en',
      detectBrowser: true,
      persistSelection: true,
      supported: [
        { code: 'en', locale: 'en-US', label: 'English' },
        { code: 'fr', locale: 'fr-FR', label: 'Français' },
      ],
      translations: {
        en: { 'common.save': 'Save' },
        fr: { 'common.save': 'Enregistrer' },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguagesSchema)(languages)

    // THEN: All features should be accepted
    expect(result.default).toBe('en')
    expect(result.fallback).toBe('en')
    expect(result.detectBrowser).toBe(true)
    expect(result.persistSelection).toBe(true)
    expect(result.supported).toHaveLength(2)
    expect(result.translations).toBeDefined()
  })

  test('should reject configuration without default', () => {
    // GIVEN: Configuration missing required default
    const languages = {
      supported: [{ code: 'en', locale: 'en-US', label: 'English' }],
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(LanguagesSchema)(languages)).toThrow()
  })

  test('should reject configuration without supported array', () => {
    // GIVEN: Configuration missing required supported
    const languages = {
      default: 'en',
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected
    expect(() => Schema.decodeUnknownSync(LanguagesSchema)(languages)).toThrow()
  })

  test('should reject configuration with empty supported array', () => {
    // GIVEN: Configuration with empty supported array
    const languages = {
      default: 'en',
      supported: [],
    }

    // WHEN: Schema validation is performed
    // THEN: Should be rejected (minimum 1 item required)
    expect(() => Schema.decodeUnknownSync(LanguagesSchema)(languages)).toThrow()
  })
})
