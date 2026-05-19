/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


interface LanguagePreference {
  readonly language: string
  readonly quality: number
}

export function parseAcceptLanguage(header: string | null | undefined): ReadonlyArray<string> {
  if (!header) {
    return []
  }

  const sortedPreferences: ReadonlyArray<LanguagePreference> = header
    .split(',')
    .map((lang) => {
      const [language, qualityStr] = lang.trim().split(';')

      if (!language) {
        return undefined
      }

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

export function detectLanguageFromHeader(
  header: string | null | undefined,
  supportedLanguages: ReadonlyArray<string>
): string | undefined {
  const preferences = parseAcceptLanguage(header)

  const exactMatch = preferences.find((preferred) => supportedLanguages.includes(preferred))
  if (exactMatch) {
    return exactMatch
  }

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
