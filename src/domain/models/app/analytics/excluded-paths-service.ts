/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { matchesAnyGlobPattern } from '@/domain/kernel/matching/glob-matcher'
import { leadingLanguageOf } from '@/domain/kernel/matching/localized-path'

/**
 * Whether `analytics.excludedPaths` excludes the path a visitor is SERVED.
 *
 * A pattern matches the served path as written (`/fr/diagnostic`), or, when
 * its first segment is one of the app's languages, the served path without that
 * segment (`/diagnostic`). So `/en/pricing` excludes the English page only, and
 * `/pricing` excludes that page in every language. The page renderer, which
 * decides whether to inline the tracker, and the collectors, which receive
 * `location.pathname`, both judge with this one function, so the tracker is
 * left out of exactly the pages whose events would be dropped.
 *
 * @param excludedPaths - The configured glob patterns
 * @param servedPath - The path as the visitor's browser shows it
 * @param languages - The app's supported language codes
 */
export function isPathExcludedFromAnalytics(
  excludedPaths: readonly string[] | undefined,
  servedPath: string,
  languages: readonly string[]
): boolean {
  if (excludedPaths === undefined || excludedPaths.length === 0) return false
  if (matchesAnyGlobPattern(excludedPaths, servedPath)) return true
  const language = leadingLanguageOf(servedPath, languages)
  if (language === undefined) return false
  const unprefixed = servedPath.slice(servedPath.indexOf(language) + language.length)
  return matchesAnyGlobPattern(excludedPaths, unprefixed === '' ? '/' : unprefixed)
}
