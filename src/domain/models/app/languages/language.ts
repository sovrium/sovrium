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
 */
export const LanguageCodeSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Language Code',
    description: 'Short language code (2 letters) for URLs and routing',
    examples: ['en', 'fr', 'es', 'de', 'ar', 'he'],
  }),
  Schema.check(
    Schema.isPattern(/^[a-z]{2}$/, {
      message: 'Language code must be 2 lowercase letters (ISO 639-1 format, e.g., en, fr, es)',
    })
  )
)

/**
 * Multi-language support configuration for the entire application
 *
 * Provides:
 * - default: Default language short code (required, e.g., 'en', 'fr')
 * - supported: Array of supported languages with metadata (required)
 * - fallback: Language to use when translation is missing (optional, defaults to default language)
 * - detectBrowser: Auto-detect language from browser (optional, defaults to true)
 * - persistSelection: Remember the user's language choice — in the browser AND
 *   in the `sovrium_language` cookie the SERVER reads, so the next document is
 *   composed in the chosen language rather than merely repainted after
 *   hydration (optional, defaults to true). `false` disables BOTH sides: the
 *   switcher writes no cookie, and a cookie that arrives anyway is ignored.
 *   See `LANGUAGE_PREFERENCE_COOKIE` / `resolvePreferredLanguage` in
 *   `./language-detection`.
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
 */
export const LanguagesSchema = Schema.Struct({
  default: LanguageCodeSchema,
  supported: Schema.Array(LanguageConfigSchema).pipe(
    Schema.annotate({
      title: 'Supported Languages',
      description: 'List of supported languages',
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  fallback: Schema.optional(LanguageCodeSchema),
  detectBrowser: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Detect Browser Language',
      description:
        "Picks the language from the reader's browser on a first visit, when the address itself does not name one.",
    })
  ),
  persistSelection: Schema.optional(
    Schema.Boolean.annotate({
      title: 'Persist Language Selection',
      description:
        'Remember the reader’s language choice (default: true). Remembered in BOTH halves at once: the browser, and the `sovrium_language` cookie the SERVER reads — so the next document is composed in the chosen language rather than repainted after it arrives. `false` disables both sides: the switcher writes nothing, and a cookie or account preference that arrives anyway is ignored. It never disables the language feature itself — a `/{lang}/` address still works.',
    })
  ),
  translations: Schema.optional(TranslationsSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Languages',
    title: 'Languages Configuration',
    description: 'Multi-language support configuration for the entire application',
  }),
  Schema.check(
    Schema.makeFilter((input) => {
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
