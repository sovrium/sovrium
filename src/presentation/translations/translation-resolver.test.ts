/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { resolveTranslationPattern } from './translation-resolver'

describe('resolveTranslationPattern - Fallback Behavior', () => {
  test('should use translation from current language when it exists', () => {
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' as const },
        { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' as const },
      ],
      translations: {
        en: {
          'common.save': 'Save',
          'common.cancel': 'Cancel',
        },
        fr: {
          'common.save': 'Enregistrer',
          // 'common.cancel' is missing - will fall back to English
        },
      },
    }

    const result = resolveTranslationPattern('$t:common.save', 'fr-FR', languages)
    expect(result).toBe('Enregistrer')
  })

  test('should fall back to default language when translation is missing in current language', () => {
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' as const },
        { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' as const },
      ],
      translations: {
        en: {
          'common.save': 'Save',
          'common.cancel': 'Cancel',
        },
        fr: {
          'common.save': 'Enregistrer',
          // 'common.cancel' is missing - will fall back to English
        },
      },
    }

    const result = resolveTranslationPattern('$t:common.cancel', 'fr-FR', languages)
    expect(result).toBe('Cancel')
  })

  test('should normalize language code from full locale to base language (fr-FR → fr)', () => {
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' as const },
        { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' as const },
      ],
      translations: {
        en: {
          'hero.title': 'Welcome',
        },
        fr: {
          'hero.title': 'Bienvenue',
        },
      },
    }

    // When currentLang is 'fr-FR' but translations use 'fr'
    const result = resolveTranslationPattern('$t:hero.title', 'fr-FR', languages)
    expect(result).toBe('Bienvenue')
  })

  test('should normalize language code from full locale to base language (en-US → en)', () => {
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' as const },
        { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' as const },
      ],
      translations: {
        en: {
          'hero.title': 'Welcome',
        },
        fr: {
          'hero.title': 'Bienvenue',
        },
      },
    }

    // When currentLang is 'en-US' but translations use 'en'
    const result = resolveTranslationPattern('$t:hero.title', 'en-US', languages)
    expect(result).toBe('Welcome')
  })

  test('should use short code for translation lookups', () => {
    const languages = {
      default: 'en',
      fallback: 'en',
      supported: [
        { code: 'en', locale: 'en-US', label: 'English (US)', direction: 'ltr' as const },
        { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' as const },
      ],
      translations: {
        en: {
          'common.color': 'color',
        },
        fr: {
          'common.color': 'couleur',
        },
      },
    }

    // Translation keys use short codes (en, fr) not full locales
    const result = resolveTranslationPattern('$t:common.color', 'en-US', languages)
    expect(result).toBe('color')
  })
})
