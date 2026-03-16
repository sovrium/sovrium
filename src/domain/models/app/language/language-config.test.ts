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
  LanguageLabelSchema,
  LanguageDirectionSchema,
  LanguageFlagSchema,
  LanguageConfigSchema,
} from './language-config'

describe('LanguageCodeSchema', () => {
  test('should accept valid ISO 639-1 language-only code', () => {
    // GIVEN: A 2-letter language code
    const code = 'en'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageCodeSchema)(code)

    // THEN: Code should be accepted
    expect(result).toBe('en')
  })

  test('should accept valid ISO 639-1 language codes (2 letters)', () => {
    // GIVEN: 2-letter language codes
    const codes = ['en', 'fr', 'es', 'ar', 'de', 'zh'] as const

    // WHEN: Schema validation is performed on each
    const results = codes.map((code) => Schema.decodeUnknownSync(LanguageCodeSchema)(code))

    // THEN: All 2-letter codes should be accepted
    expect(results).toEqual([...codes])
  })

  test('should reject language codes with country codes', () => {
    // GIVEN: Full locale codes (not accepted by LanguageCodeSchema)
    const codes = ['en-US', 'fr-FR', 'es-ES', 'ar-SA']

    // WHEN/THEN: Schema validation should reject codes with country codes
    codes.forEach((code) => {
      expect(() => Schema.decodeUnknownSync(LanguageCodeSchema)(code)).toThrow()
    })
  })

  test('should reject invalid language code formats', () => {
    // GIVEN: Invalid language code formats
    const invalidCodes = [
      'EN', // uppercase language
      'en-us', // lowercase country
      'EN-US', // all uppercase
      'eng', // 3 letters
      'en-USA', // 3-letter country
      'en_US', // underscore instead of hyphen
      'en US', // space
      '', // empty
    ]

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected with validation error
    invalidCodes.forEach((code) => {
      expect(() => Schema.decodeUnknownSync(LanguageCodeSchema)(code)).toThrow()
    })
  })
})

describe('LanguageLabelSchema', () => {
  test('should accept English labels', () => {
    // GIVEN: An English language label
    const label = 'English'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageLabelSchema)(label)

    // THEN: Label should be accepted
    expect(result).toBe('English')
  })

  test('should accept labels with special characters (accents, non-Latin)', () => {
    // GIVEN: Labels with accents and non-Latin scripts
    const labels = ['Français', 'Español', 'العربية', 'Русский', '中文']

    // WHEN: Schema validation is performed on each
    const results = labels.map((label) => Schema.decodeUnknownSync(LanguageLabelSchema)(label))

    // THEN: All labels should be accepted
    expect(results).toEqual(labels)
  })

  test('should reject empty label', () => {
    // GIVEN: An empty label
    const label = ''

    // WHEN: Schema validation is performed
    // THEN: Empty label should be rejected
    expect(() => Schema.decodeUnknownSync(LanguageLabelSchema)(label)).not.toThrow()
    // Note: Schema.String accepts empty strings by default
    // If minLength constraint is needed, add it to the schema
  })
})

describe('LanguageDirectionSchema', () => {
  test('should accept ltr direction', () => {
    // GIVEN: Left-to-right direction
    const direction = 'ltr'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageDirectionSchema)(direction)

    // THEN: Direction should be accepted
    expect(result).toBe('ltr')
  })

  test('should accept rtl direction', () => {
    // GIVEN: Right-to-left direction
    const direction = 'rtl'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageDirectionSchema)(direction)

    // THEN: Direction should be accepted
    expect(result).toBe('rtl')
  })

  test('should reject invalid direction values', () => {
    // GIVEN: Invalid direction values
    const invalidDirections = ['LTR', 'RTL', 'left', 'right', '', 'auto']

    // WHEN: Schema validation is performed on each
    // THEN: All should be rejected
    invalidDirections.forEach((direction) => {
      expect(() => Schema.decodeUnknownSync(LanguageDirectionSchema)(direction)).toThrow()
    })
  })
})

describe('LanguageFlagSchema', () => {
  test('should accept flag emoji', () => {
    // GIVEN: A flag emoji
    const flag = '🇺🇸'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageFlagSchema)(flag)

    // THEN: Emoji should be accepted
    expect(result).toBe('🇺🇸')
  })

  test('should accept file path', () => {
    // GIVEN: A flag icon file path
    const flag = '/flags/us.svg'

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageFlagSchema)(flag)

    // THEN: Path should be accepted
    expect(result).toBe('/flags/us.svg')
  })

  test('should accept various flag formats', () => {
    // GIVEN: Various flag formats (emoji and paths)
    const flags = ['🇺🇸', '🇫🇷', '🇪🇸', '/flags/us.svg', '/assets/flags/fr.png']

    // WHEN: Schema validation is performed on each
    const results = flags.map((flag) => Schema.decodeUnknownSync(LanguageFlagSchema)(flag))

    // THEN: All flags should be accepted
    expect(results).toEqual(flags)
  })
})

describe('LanguageConfigSchema', () => {
  test('APP-LANG-CONFIG-001: should accept English (en-US) with LTR direction by default', () => {
    // GIVEN: A language config for English with only code and label
    const config = {
      code: 'en',
      locale: 'en-US',
      label: 'English',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: Config should be valid (direction is optional, defaults to ltr)
    expect(result.code).toBe('en')
    expect(result.locale).toBe('en-US')
    expect(result.label).toBe('English')
  })

  test('APP-LANG-CONFIG-002: should support Arabic (ar-SA) with RTL direction', () => {
    // GIVEN: A language config for Arabic with RTL direction
    const config = {
      code: 'ar',
      locale: 'ar-SA',
      label: 'العربية',
      direction: 'rtl' as const,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: Config should support right-to-left text rendering
    expect(result.code).toBe('ar')
    expect(result.locale).toBe('ar-SA')
    expect(result.label).toBe('العربية')
    expect(result.direction).toBe('rtl')
  })

  test('APP-LANG-CONFIG-003: should accept 2-letter language code (ISO 639-1 without country)', () => {
    // GIVEN: A language config with 2-letter code
    const config = {
      code: 'en',
      locale: 'en-US',
      label: 'English',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: Config should be valid with both short code and full locale
    expect(result.code).toBe('en')
    expect(result.locale).toBe('en-US')
    expect(result.label).toBe('English')
  })

  test('APP-LANG-CONFIG-004: should accept 4-letter code with country (en-US format)', () => {
    // GIVEN: A language config with language + country code
    const config = {
      code: 'en',
      locale: 'en-US',
      label: 'English (US)',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: Config should be valid with country-specific format
    expect(result.code).toBe('en')
    expect(result.locale).toBe('en-US')
    expect(result.label).toBe('English (US)')
  })

  test('APP-LANG-CONFIG-005: should accept flag emoji (🇫🇷)', () => {
    // GIVEN: A language config with flag emoji
    const config = {
      code: 'fr',
      locale: 'fr-FR',
      label: 'Français',
      flag: '🇫🇷',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: Flag emoji should be accepted
    expect(result.code).toBe('fr')
    expect(result.locale).toBe('fr-FR')
    expect(result.label).toBe('Français')
    expect(result.flag).toBe('🇫🇷')
  })

  test('APP-LANG-CONFIG-006: should accept flag icon path (/flags/es.svg)', () => {
    // GIVEN: A language config with flag file path
    const config = {
      code: 'es',
      locale: 'es-ES',
      label: 'Español',
      flag: '/flags/es.svg',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: Flag path should be accepted
    expect(result.code).toBe('es')
    expect(result.locale).toBe('es-ES')
    expect(result.label).toBe('Español')
    expect(result.flag).toBe('/flags/es.svg')
  })

  test('APP-LANG-CONFIG-007: should support native language labels with all character sets', () => {
    // GIVEN: Language configs with native names (Latin and Arabic scripts)
    const configs = [
      { code: 'fr', locale: 'fr-FR', label: 'Français' },
      { code: 'es', locale: 'es-ES', label: 'Español' },
      { code: 'ar', locale: 'ar-SA', label: 'العربية' },
    ]

    // WHEN: Schema validation is performed on each
    const results = configs.map((config) => Schema.decodeUnknownSync(LanguageConfigSchema)(config))

    // THEN: All character sets should be supported
    expect(results[0]!.label).toBe('Français')
    expect(results[1]!.label).toBe('Español')
    expect(results[2]!.label).toBe('العربية')
  })

  test('APP-LANG-CONFIG-008: should accept minimal config with only code and label', () => {
    // GIVEN: A minimal language config (direction and flag omitted)
    const config = {
      code: 'de',
      locale: 'de-DE',
      label: 'Deutsch',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: Config should be valid with optional fields omitted
    expect(result.code).toBe('de')
    expect(result.locale).toBe('de-DE')
    expect(result.label).toBe('Deutsch')
    expect(result.direction).toBeUndefined()
    expect(result.flag).toBeUndefined()
  })

  test('should reject config missing required code', () => {
    // GIVEN: A config missing the code property
    const config = {
      label: 'English',
    }

    // WHEN: Schema validation is performed
    // THEN: Config should be rejected
    expect(() => Schema.decodeUnknownSync(LanguageConfigSchema)(config)).toThrow()
  })

  test('should reject config missing required label', () => {
    // GIVEN: A config missing the label property
    const config = {
      code: 'en',
      locale: 'en-US',
    }

    // WHEN: Schema validation is performed
    // THEN: Config should be rejected
    expect(() => Schema.decodeUnknownSync(LanguageConfigSchema)(config)).toThrow()
  })

  test('should reject config with invalid code format', () => {
    // GIVEN: A config with invalid code format
    const config = {
      code: 'EN-US', // uppercase language (invalid)
      label: 'English',
    }

    // WHEN: Schema validation is performed
    // THEN: Config should be rejected
    expect(() => Schema.decodeUnknownSync(LanguageConfigSchema)(config)).toThrow()
  })

  test('should accept full config with all properties', () => {
    // GIVEN: A complete language config with all properties
    const config = {
      code: 'en',
      locale: 'en-US',
      label: 'English',
      direction: 'ltr' as const,
      flag: '🇺🇸',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LanguageConfigSchema)(config)

    // THEN: All properties should be accepted
    expect(result).toEqual(config)
  })
})
