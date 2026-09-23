/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Short language code (ISO 639-1, used for URLs/routing)
 *
 * 2 lowercase letters only (no country code)
 * Used for URL paths like /en/, /fr/, /es/
 *
 * @example
 * ```typescript
 * const code1 = 'en'  // English
 * const code2 = 'fr'  // French
 * const code3 = 'ar'  // Arabic
 * ```
 *
 * @see [internal ref]#/properties/code
 */
export const LanguageCodeSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Language Code',
    description: 'Short language code used for URLs and routing (ISO 639-1, 2 letters)',
    examples: ['en', 'fr', 'es', 'de', 'ar', 'he'],
  }),
  Schema.check(
    Schema.isPattern(/^[a-z]{2}$/, {
      message: 'Language code must be ISO 639-1 format (2 lowercase letters, e.g., "en", "fr")',
    })
  )
)

/**
 * Full locale code (ISO 639-1 + ISO 3166-1, used for HTML lang attribute)
 *
 * Format: language-COUNTRY (e.g., 'en-US', 'fr-FR')
 * Used for HTML lang attribute and locale-specific formatting
 *
 * @example
 * ```typescript
 * const locale1 = 'en-US'  // English (United States)
 * const locale2 = 'fr-FR'  // French (France)
 * const locale3 = 'ar-SA'  // Arabic (Saudi Arabia)
 * ```
 *
 * @see [internal ref]#/properties/locale
 */
export const LanguageLocaleSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Language Locale',
    description: 'Full locale code used for HTML lang attribute and locale-specific formatting',
    examples: ['en-US', 'fr-FR', 'es-ES', 'de-DE', 'ar-SA', 'he-IL'],
  }),
  Schema.check(
    Schema.isPattern(/^[a-z]{2}-[A-Z]{2}$/, {
      message: 'Locale must be ISO 639-1 + ISO 3166-1 format (e.g., "en-US", "fr-FR")',
    })
  )
)

/**
 * Human-readable language name
 *
 * Should use the language's native name for better UX
 * (e.g., "Français" instead of "French", "العربية" instead of "Arabic")
 *
 * @example
 * ```typescript
 * const label1 = 'English'
 * const label2 = 'Français'  // French in French
 * const label3 = 'العربية'    // Arabic in Arabic
 * ```
 *
 * @see [internal ref]#/properties/label
 */
export const LanguageLabelSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Language Label',
    description: 'Human-readable language name',
    examples: ['English', 'Français', 'Español', 'العربية'],
  })
)

/**
 * Text direction (left-to-right or right-to-left)
 *
 * Controls the base text flow direction:
 * - 'ltr': Left-to-right (default for most languages)
 * - 'rtl': Right-to-left (for Arabic, Hebrew, etc.)
 *
 * @example
 * ```typescript
 * const ltr = 'ltr'  // English, French, Spanish
 * const rtl = 'rtl'  // Arabic, Hebrew, Persian
 * ```
 *
 * @see [internal ref]#/properties/direction
 */
export const LanguageDirectionSchema = Schema.Literals(['ltr', 'rtl']).pipe(
  Schema.annotate({
    title: 'Text Direction',
    description: 'Text direction (left-to-right or right-to-left)',
  })
)

/**
 * Flag emoji or icon path
 *
 * Can be either:
 * - Unicode emoji: '🇺🇸', '🇫🇷', '🇪🇸' (instant, no loading)
 * - File path: '/flags/us.svg' (custom design, consistent styling)
 *
 * @example
 * ```typescript
 * const emoji = '🇺🇸'          // Unicode flag emoji
 * const path = '/flags/us.svg'  // Custom SVG flag
 * ```
 *
 * @see [internal ref]#/properties/flag
 */
export const LanguageFlagSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Language Flag',
    description: 'Flag emoji or icon path',
    examples: ['🇺🇸', '🇫🇷', '🇪🇸', '/flags/us.svg'],
  })
)

/**
 * Configuration for a single supported language
 *
 * Defines a language option in the language switcher with:
 * - Short code for URLs (en, fr) - used for routing
 * - Full locale for HTML (en-US, fr-FR) - used for lang attribute
 * - Native language name for better UX
 * - Text direction for RTL language support
 * - Optional flag emoji or icon
 *
 * Key behaviors:
 * - Code, locale, and label are required properties
 * - Code (short) is used for URL paths: /en/, /fr/
 * - Locale (full) is used for HTML lang attribute: lang="en-US"
 * - Direction defaults to 'ltr' when omitted
 * - Flag is optional for minimal configuration
 *
 * @example
 * ```typescript
 * // English (US) with all properties
 * const enUS = {
 *   code: 'en',
 *   locale: 'en-US',
 *   label: 'English',
 *   direction: 'ltr',
 *   flag: '🇺🇸'
 * }
 *
 * // Arabic with RTL support
 * const arSA = {
 *   code: 'ar',
 *   locale: 'ar-SA',
 *   label: 'العربية',
 *   direction: 'rtl',
 *   flag: '🇸🇦'
 * }
 *
 * // Minimal configuration
 * const deDE = {
 *   code: 'de',
 *   locale: 'de-DE',
 *   label: 'Deutsch'
 *   // direction defaults to 'ltr'
 *   // flag omitted
 * }
 * ```
 *
 */
export const LanguageConfigSchema = Schema.Struct({
  code: LanguageCodeSchema,
  locale: Schema.optional(LanguageLocaleSchema).annotate({
    description:
      'Full locale code (optional - defaults to short code if not specified). Used for HTML lang attribute and hreflang links.',
  }),
  label: LanguageLabelSchema,
  direction: Schema.optional(LanguageDirectionSchema),
  flag: Schema.optional(LanguageFlagSchema),
}).pipe(
  Schema.annotate({
    title: 'Language Configuration',
    description: 'Configuration for a single supported language',
  })
)

/** @public */
export type LanguageCode = Schema.Schema.Type<typeof LanguageCodeSchema>
/** @public */
export type LanguageLocale = Schema.Schema.Type<typeof LanguageLocaleSchema>
/** @public */
export type LanguageLabel = Schema.Schema.Type<typeof LanguageLabelSchema>
/** @public */
export type LanguageDirection = Schema.Schema.Type<typeof LanguageDirectionSchema>
/** @public */
export type LanguageFlag = Schema.Schema.Type<typeof LanguageFlagSchema>
export type LanguageConfig = Schema.Schema.Type<typeof LanguageConfigSchema>
