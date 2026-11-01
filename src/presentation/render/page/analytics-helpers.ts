/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { matchesAnyGlobPattern } from '@/domain/kernel/matching/glob-matcher'
import { resolvePrivacySignals } from '@/domain/models/app/analytics/privacy-signals-service'
import type { BuiltInAnalytics } from '@/domain/models/app/analytics'
import type { Consent } from '@/domain/models/app/consent'
import type { Languages } from '@/domain/models/app/languages'
import type { AnalyticsBeaconSettings } from '@/presentation/render/page/analytics-beacon-script'

/**
 * Extract session timeout from analytics config, defaulting to 30 minutes.
 */
function extractSessionTimeout(analytics: BuiltInAnalytics | undefined): number {
  if (analytics === undefined || analytics === false || analytics === true) return 30
  return analytics.sessionTimeout ?? 30
}

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
    sessionTimeoutMinutes: extractSessionTimeout(analytics),
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
  pagePath: string
): boolean {
  if (analytics === undefined || analytics === false) return false
  if (analytics === true) return true
  const { excludedPaths } = analytics
  if (!excludedPaths || excludedPaths.length === 0) return true
  // The same matcher the collector applies to the events it receives, so the
  // beacon is left out of exactly the pages whose events would be dropped —
  // `/admin/*` covers everything beneath `/admin`, as the option documents —
  // and a `.` or `(` in a pattern is matched literally.
  return !matchesAnyGlobPattern(excludedPaths, pagePath)
}
