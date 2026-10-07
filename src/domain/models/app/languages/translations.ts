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
  Schema.annotate({
    title: 'Translation Key',
    description: 'Key for centralized translations dictionary',
    examples: ['common.save', 'nav.home', 'homepage.hero.title', 'errors.404'],
  }),
  Schema.check(
    Schema.isPattern(/^[a-zA-Z0-9._-]+$/, {
      message:
        'Translation key must contain only alphanumeric characters, dots, hyphens, and underscores',
    })
  )
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
export const TranslationDictionarySchema = Schema.Record(Schema.String, Schema.String).pipe(
  Schema.annotate({
    title: 'Translation Dictionary',
    description: 'Maps translation keys to localized strings for a single language',
  }),
  // Keys: any string in the key position, and the pattern enforced by
  // `isPropertyNames`, so a mistyped key is refused by name at its own path
  // with the pattern it must match. A pattern on the key schema itself makes
  // Effect 4 skip the entry, and the config report then named it an unknown
  // property with nothing accepted. The JSON Schema rendering keeps the pattern.
  Schema.check(
    Schema.isPropertyNames(TranslationKeySchema, {
      toJsonSchema: () => ({ propertyNames: { type: 'string', pattern: '^[a-zA-Z0-9._-]+$' } }),
    })
  )
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
const TranslationLanguageKeySchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-z]{2}$/, {
      message: 'Language code must be 2 lowercase letters (ISO 639-1 format, e.g., en, fr, es)',
    })
  )
)

export const TranslationsSchema = Schema.Record(Schema.String, TranslationDictionarySchema).pipe(
  Schema.annotate({
    title: 'Centralized Translations',
    description:
      'Translation dictionaries for all supported languages (keyed by short codes: en, fr, es). Use $t:key syntax to reference translations.',
  }),
  // Keys: any string in the key position, and the pattern enforced by
  // `isPropertyNames`, so a mistyped key is refused by name at its own path
  // with the pattern it must match. A pattern on the key schema itself makes
  // Effect 4 skip the entry, and the config report then named it an unknown
  // property with nothing accepted. The JSON Schema rendering keeps the pattern.
  Schema.check(
    Schema.isPropertyNames(TranslationLanguageKeySchema, {
      toJsonSchema: () => ({ propertyNames: { type: 'string', pattern: '^[a-z]{2}$' } }),
    })
  )
)

/** @public */
export type TranslationKey = Schema.Schema.Type<typeof TranslationKeySchema>
/** @public */
export type TranslationDictionary = Schema.Schema.Type<typeof TranslationDictionarySchema>
/** @public */
export type Translations = Schema.Schema.Type<typeof TranslationsSchema>
