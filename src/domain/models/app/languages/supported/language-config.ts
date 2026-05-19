/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const LanguageCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z]{2}$/, {
    message: () => 'Language code must be ISO 639-1 format (2 lowercase letters, e.g., "en", "fr")',
  }),
  Schema.annotations({
    title: 'Language Code',
    description: 'Short language code used for URLs and routing (ISO 639-1, 2 letters)',
    examples: ['en', 'fr', 'es', 'de', 'ar', 'he'],
  })
)

export const LanguageLocaleSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z]{2}-[A-Z]{2}$/, {
    message: () => 'Locale must be ISO 639-1 + ISO 3166-1 format (e.g., "en-US", "fr-FR")',
  }),
  Schema.annotations({
    title: 'Language Locale',
    description: 'Full locale code used for HTML lang attribute and locale-specific formatting',
    examples: ['en-US', 'fr-FR', 'es-ES', 'de-DE', 'ar-SA', 'he-IL'],
  })
)

export const LanguageLabelSchema = Schema.String.pipe(
  Schema.annotations({
    title: 'Language Label',
    description: 'Human-readable language name',
    examples: ['English', 'Français', 'Español', 'العربية'],
  })
)

export const LanguageDirectionSchema = Schema.Literal('ltr', 'rtl').pipe(
  Schema.annotations({
    title: 'Text Direction',
    description: 'Text direction (left-to-right or right-to-left)',
  })
)

export const LanguageFlagSchema = Schema.String.pipe(
  Schema.annotations({
    title: 'Language Flag',
    description: 'Flag emoji or icon path',
    examples: ['🇺🇸', '🇫🇷', '🇪🇸', '/flags/us.svg'],
  })
)

export const LanguageConfigSchema = Schema.Struct({
  code: LanguageCodeSchema,
  locale: Schema.optional(LanguageLocaleSchema).annotations({
    description:
      'Full locale code (optional - defaults to short code if not specified). Used for HTML lang attribute and hreflang links.',
  }),
  label: LanguageLabelSchema,
  direction: Schema.optional(LanguageDirectionSchema),
  flag: Schema.optional(LanguageFlagSchema),
}).pipe(
  Schema.annotations({
    title: 'Language Configuration',
    description: 'Configuration for a single supported language',
  })
)

export type LanguageCode = Schema.Schema.Type<typeof LanguageCodeSchema>
export type LanguageLocale = Schema.Schema.Type<typeof LanguageLocaleSchema>
export type LanguageLabel = Schema.Schema.Type<typeof LanguageLabelSchema>
export type LanguageDirection = Schema.Schema.Type<typeof LanguageDirectionSchema>
export type LanguageFlag = Schema.Schema.Type<typeof LanguageFlagSchema>
export type LanguageConfig = Schema.Schema.Type<typeof LanguageConfigSchema>
