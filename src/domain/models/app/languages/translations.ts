/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Translation key for centralized translations dictionary
 *
 * Format: Alphanumeric with dots, hyphens, and underscores
 * Convention: Use namespaces for organization (e.g., common.save, nav.home, homepage.hero.title)
 *
 * @example
 * ```typescript
 * const keys = ['common.save', 'nav.home', 'homepage.hero.title', 'errors.404']
 * ```
 */
export const TranslationKeySchema = Schema.String.pipe(
  Schema.pattern(/^[a-zA-Z0-9._-]+$/, {
    message: () =>
      'Translation key must contain only alphanumeric characters, dots, hyphens, and underscores',
  }),
  Schema.annotations({
    title: 'Translation Key',
    description: 'Key for centralized translations dictionary',
    examples: ['common.save', 'nav.home', 'homepage.hero.title', 'errors.404'],
  })
)

/**
 * Translation dictionary for a single language
 *
 * Maps translation keys to localized strings.
 * Use semantic keys that describe meaning, not location.
 * Organize by feature/page for better maintainability.
 *
 * @example
 * ```typescript
 * const translations = {
 *   'common.save': 'Save',
 *   'common.cancel': 'Cancel',
 *   'nav.home': 'Home',
 *   'homepage.hero.title': 'Welcome to Sovrium'
 * }
 * ```
 */
export const TranslationDictionarySchema = Schema.Record({
  key: TranslationKeySchema,
  value: Schema.String,
}).pipe(
  Schema.annotations({
    title: 'Translation Dictionary',
    description: 'Maps translation keys to localized strings for a single language',
  })
)

/**
 * Centralized translations for all supported languages
 *
 * Outer Record key: Short language code (2 letters, e.g., en, fr, es)
 * Outer Record value: Translation dictionary for that language
 *
 * This is the PRIMARY i18n pattern. Use $t:key syntax in ANY string property
 * to reference translations: children arrays, component props, meta properties, etc.
 *
 * @example
 * ```typescript
 * const translations = {
 *   'en': {
 *     'common.save': 'Save',
 *     'nav.home': 'Home'
 *   },
 *   'fr': {
 *     'common.save': 'Enregistrer',
 *     'nav.home': 'Accueil'
 *   }
 * }
 * ```
 */
export const TranslationsSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-z]{2}$/, {
      message: () =>
        'Language code must be 2 lowercase letters (ISO 639-1 format, e.g., en, fr, es)',
    })
  ),
  value: TranslationDictionarySchema,
}).pipe(
  Schema.annotations({
    title: 'Centralized Translations',
    description:
      'Translation dictionaries for all supported languages (keyed by short codes: en, fr, es). Use $t:key syntax to reference translations.',
  })
)

/** @public */
export type TranslationKey = Schema.Schema.Type<typeof TranslationKeySchema>
/** @public */
export type TranslationDictionary = Schema.Schema.Type<typeof TranslationDictionarySchema>
/** @public */
export type Translations = Schema.Schema.Type<typeof TranslationsSchema>
