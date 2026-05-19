/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { LanguageConfigSchema } from './supported/language-config'
import { TranslationsSchema } from './translations'

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

    if (!supportedCodes.has(input.default)) {
      return 'default language must be in supported array'
    }

    if (input.fallback && !supportedCodes.has(input.fallback)) {
      return 'fallback language must be in supported array'
    }

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

export type LanguageCode = Schema.Schema.Type<typeof LanguageCodeSchema>
export type Languages = Schema.Schema.Type<typeof LanguagesSchema>

export {
  TranslationsSchema,
  TranslationKeySchema,
  TranslationDictionarySchema,
} from './translations'
export type { TranslationKey, TranslationDictionary, Translations } from './translations'
