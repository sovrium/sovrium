/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildPageViewTracker } from '@/domain/models/app/analytics/page-view-tracker-service'
import { analyticsConsentHold } from '@/domain/models/app/consent/consent-version-service'
import { generateClickDelegateScript } from '@/presentation/render/scripts/click-delegate-script'
import type { PrivacySignalSettings } from '@/domain/models/app/analytics/privacy-signals-service'
import type { Consent } from '@/domain/models/app/consent'
import type { Languages } from '@/domain/models/app/languages'

/** What a page reads from the app about its `consent` block. */
export type PageConsent = {
  readonly declaration: Consent
  /** The app's languages, for the purposes' `$t:` keys and the banner's strings. */
  readonly languages: Languages | undefined
}

/** What the beacon reads from the app's `analytics` settings. */
export type AnalyticsBeaconSettings = PrivacySignalSettings & {
  /** `analytics.sessionTimeout`, default 30 */
  readonly sessionTimeoutMinutes: number
  /** The app's `consent` block, when it declares one. */
  readonly consent?: PageConsent
}

/**
 * The built-in analytics beacon, inlined into `<head>`.
 *
 * The ONE tracker a page or the fallback not-found page inlines: the shared
 * page-view tracker (`buildPageViewTracker`) plus the on-page outbound-click
 * delegate, which only this copy carries.
 *
 * Deliberately hand-minified rather than built: it must run BEFORE anything else
 * on the page, so it ships as an inline script with no fetch of its own.
 *
 * It reads the operator's Do Not Track and Global Privacy Control settings, and
 * sends nothing from a browser reporting a signal they honour. When the app
 * declares an `analytics` purpose it also holds until that purpose is accepted.
 *
 * @param appName - `page.name`, reported as the analytics app identifier
 * @param settings - The app's resolved analytics settings
 */
export function buildAnalyticsBeaconScript(
  appName: string,
  settings: AnalyticsBeaconSettings
): string {
  const consentHold = analyticsConsentHold(settings.consent?.declaration)
  return buildPageViewTracker({
    endpoint: '/api/analytics/collect',
    appName,
    privacySignals: settings,
    ...(consentHold === undefined ? {} : { consentHold }),
    extraDeclarations: `,sessionTimeout=${settings.sessionTimeoutMinutes}`,
    epilogue: generateClickDelegateScript(),
  })
}
