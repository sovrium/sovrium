/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Accept-Language Header Parser
 *
 * Parses the Accept-Language HTTP header and returns an ordered list of
 * preferred languages based on quality values (q parameter).
 *
 * Format: Accept-Language: en-US,en;q=0.9,fr;q=0.8
 *
 * @example
 * ```typescript
 * const languages = parseAcceptLanguage('en-US,en;q=0.9,fr;q=0.8')
 * // Returns: ['en-US', 'en', 'fr']
 * ```
 */

interface LanguagePreference {
  readonly language: string
  readonly quality: number
}

/**
 * Parse Accept-Language header into ordered list of language preferences
 *
 * @param header - Accept-Language header value (e.g., 'en-US,en;q=0.9,fr;q=0.8')
 * @returns Array of language codes ordered by preference (highest quality first)
 */
export function parseAcceptLanguage(header: string | null | undefined): ReadonlyArray<string> {
  if (!header) {
    return []
  }

  // Parse each language-quality pair and sort by quality (highest first)
  const sortedPreferences: ReadonlyArray<LanguagePreference> = header
    .split(',')
    .map((lang) => {
      const [language, qualityStr] = lang.trim().split(';')

      // Skip invalid entries without a language code
      if (!language) {
        return undefined
      }

      // Extract quality value (default is 1.0 if not specified)
      const quality = qualityStr ? parseFloat(qualityStr.split('=')[1] || '1.0') : 1.0

      return {
        language: language.trim(),
        quality: isNaN(quality) ? 0 : quality,
      }
    })
    .filter(
      (pref): pref is LanguagePreference =>
        pref !== undefined && pref.language.length > 0 && pref.quality > 0
    )
    .toSorted((a, b) => b.quality - a.quality)

  return sortedPreferences.map((pref) => pref.language)
}

/**
 * Detect best matching language from Accept-Language header
 *
 * Tries exact match first (e.g., 'fr-FR' === 'fr-FR'),
 * then base language match (e.g., 'fr' from 'fr-FR' matches 'fr-CA')
 *
 * @param header - Accept-Language header value
 * @param supportedLanguages - Array of supported language codes
 * @returns Best matching language code or undefined
 */
export function detectLanguageFromHeader(
  header: string | null | undefined,
  supportedLanguages: ReadonlyArray<string>
): string | undefined {
  const preferences = parseAcceptLanguage(header)

  // Try exact matches first
  const exactMatch = preferences.find((preferred) => supportedLanguages.includes(preferred))
  if (exactMatch) {
    return exactMatch
  }

  // Try base language matches (e.g., 'fr' from 'fr-FR')
  const baseMatch = preferences
    .map((preferred) => ({
      preferred,
      basePreferred: preferred.split('-')[0],
    }))
    .find(({ basePreferred }) =>
      supportedLanguages.some((supported) => supported.split('-')[0] === basePreferred)
    )

  if (baseMatch) {
    return supportedLanguages.find(
      (supported) => supported.split('-')[0] === baseMatch.basePreferred
    )
  }

  return undefined
}
