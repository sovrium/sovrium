/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LanguageConfigSchema } from './supported/language-config'
import { TranslationsSchema } from './translations'

/**
 * Short language code for URLs and routing
 *
 * Format: ll (two lowercase letters)
 * - ll: ISO 639-1 language code
 *
 * Used for:
 * - URL paths (e.g., /en/, /fr/, /es/)
 * - Translation dictionary keys
 * - Default language setting
 *
 * @example
 * ```typescript
 * const codes = ['en', 'fr', 'es', 'de', 'ar', 'he']
 * ```
 *
 * @see specs/app/languages/languages.schema.json
 */
export const LanguageCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z]{2}$/, {
    message: () => 'Language code must be 2 lowercase letters (ISO 639-1 format, e.g., en, fr, es)',
  }),
  Schema.annotations({
    title: 'Language Code',
    description: 'Short language code (2 letters) for URLs and routing',
    examples: ['en', 'fr', 'es', 'de', 'ar', 'he'],
  })
)

/**
 * Multi-language support configuration for the entire application
 *
 * Provides:
 * - default: Default language short code (required, e.g., 'en', 'fr')
 * - supported: Array of supported languages with metadata (required)
 * - fallback: Language to use when translation is missing (optional, defaults to default language)
 * - detectBrowser: Auto-detect language from browser (optional, defaults to true)
 * - persistSelection: Remember user's language choice in localStorage (optional, defaults to true)
 * - translations: Centralized translation dictionaries (optional, keyed by short codes)
 *
 * Language codes follow a dual pattern:
 * - code: Short code (en, fr) for URLs and translation keys
 * - locale: Full locale (en-US, fr-FR) for HTML lang attribute
 *
 * @example
 * ```typescript
 * const languages = {
 *   default: 'en',
 *   supported: [
 *     { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' },
 *     { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' }
 *   ],
 *   detectBrowser: true,
 *   persistSelection: true,
 *   translations: {
 *     'en': { 'common.save': 'Save' },
 *     'fr': { 'common.save': 'Enregistrer' }
 *   }
 * }
 * ```
 *
 * @see specs/app/languages/languages.schema.json
 */
export const LanguagesSchema = Schema.Struct({
  default: LanguageCodeSchema,
  supported: Schema.Array(LanguageConfigSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Supported Languages',
      description: 'List of supported languages',
    })
  ),
  fallback: Schema.optional(LanguageCodeSchema),
  detectBrowser: Schema.optional(Schema.Boolean),
  persistSelection: Schema.optional(Schema.Boolean),
  translations: Schema.optional(TranslationsSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Languages',
    title: 'Languages Configuration',
    description: 'Multi-language support configuration for the entire application',
  }),
  Schema.filter((input) => {
    const supportedCodes = new Set(input.supported.map((lang) => lang.code))

    // Default language must be in supported array
    if (!supportedCodes.has(input.default)) {
      return 'default language must be in supported array'
    }

    // Fallback language must be in supported array (if specified)
    if (input.fallback && !supportedCodes.has(input.fallback)) {
      return 'fallback language must be in supported array'
    }

    // If translations are provided, validate they only contain supported languages
    if (input.translations) {
      const translationCodes = Object.keys(input.translations)
      const unsupportedCodes = translationCodes.filter((code) => !supportedCodes.has(code))
      if (unsupportedCodes.length > 0) {
        return `translations contain unsupported language codes: ${unsupportedCodes.join(', ')}. Only these are supported: ${[...supportedCodes].join(', ')}`
      }
    }

    return undefined
  })
)

/** @public */
export type LanguageCode = Schema.Schema.Type<typeof LanguageCodeSchema>
export type Languages = Schema.Schema.Type<typeof LanguagesSchema>

// Re-export translation types from dedicated module
export {
  TranslationsSchema,
  TranslationKeySchema,
  TranslationDictionarySchema,
} from './translations'
export type { TranslationKey, TranslationDictionary, Translations } from './translations'
