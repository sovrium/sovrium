/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isLocalizedPagePath,
  leadingLanguageOf,
  primaryPagePath,
  withLanguagePrefix,
} from '@/domain/kernel/matching/localized-path'
import { fillRoutePattern } from '@/domain/kernel/matching/route-matcher'
import { isPathExcludedFromAnalytics } from '@/domain/models/app/analytics/excluded-paths-service'
import { resolvePrivacySignals } from '@/domain/models/app/analytics/privacy-signals-service'
import { resolveSessionTimeout } from '@/domain/models/app/analytics/session-timeout-service'
import { getSupportedLanguageCodes } from '@/domain/models/app/languages/language-detection'
import type { DeclaredPagePath } from '@/domain/kernel/matching/localized-path'
import type { App } from '@/domain/models/app'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'
import type { Consent } from '@/domain/models/app/consent'
import type { Languages } from '@/domain/models/app/languages'
import type { AnalyticsBeaconSettings } from '@/presentation/render/page/analytics-beacon-script'

/**
 * Everything the inlined tracker reads from the analytics config: the session
 * timeout and the privacy signals it honours, each at its documented default,
 * and the app's `consent` block, which can hold it back.
 */
export function extractBeaconSettings(
  analytics: BuiltInAnalytics | undefined,
  consent?: Consent,
  languages?: Languages
): AnalyticsBeaconSettings {
  return {
    sessionTimeoutMinutes: resolveSessionTimeout(analytics),
    ...resolvePrivacySignals(analytics),
    ...(consent === undefined ? {} : { consent: { declaration: consent, languages } }),
  }
}

/**
 * Check if built-in analytics tracking should be injected for a given page path.
 *
 * Returns true when analytics is configured and enabled, and the page path
 * matches none of the `excludedPaths` glob patterns.
 */
export function shouldInjectAnalytics(
  analytics: BuiltInAnalytics | undefined,
  servedPath: string,
  languages: readonly string[] = []
): boolean {
  if (analytics === undefined || analytics === false) return false
  if (analytics === true) return true
  // The same rule the collector applies to the events it receives, so the
  // beacon is left out of exactly the pages whose events would be dropped —
  // `/admin/*` covers everything beneath `/admin`, as the option documents,
  // and `/pricing` covers `/fr/pricing` too.
  return !isPathExcludedFromAnalytics(analytics.excludedPaths, servedPath, languages)
}

/**
 * The path a page is served at, as the visitor's browser shows it: the page's
 * address in the URL's language (a plain path under that language's prefix),
 * with its route parameters filled in.
 */
function servedPagePath(
  path: DeclaredPagePath,
  urlLanguage: string | undefined,
  routeParams: Readonly<Record<string, string>>,
  languages: readonly string[]
): string {
  const pattern = isLocalizedPagePath(path)
    ? primaryPagePath(path, urlLanguage)
    : urlLanguage !== undefined && leadingLanguageOf(path, languages) === undefined
      ? withLanguagePrefix(urlLanguage, path)
      : path
  return fillRoutePattern(pattern, routeParams)
}

/**
 * Whether the page served at this address carries the tracker: the app's
 * `analytics` judged against the path the visitor's browser shows, the one the
 * collector will receive.
 */
export function shouldInjectAnalyticsOnPage(
  app: App,
  path: DeclaredPagePath,
  urlLanguage: string | undefined,
  routeParams: Readonly<Record<string, string>>
): boolean {
  const languages = getSupportedLanguageCodes(app)
  return shouldInjectAnalytics(
    app.analytics,
    servedPagePath(path, urlLanguage, routeParams, languages),
    languages
  )
}
