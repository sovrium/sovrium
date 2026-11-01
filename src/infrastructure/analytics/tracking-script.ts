/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildPageViewTracker } from '@/domain/models/app/analytics/page-view-tracker-service'
import type {
  PrivacySignalSettings,
  TrackerConsentHold,
} from '@/domain/models/app/analytics/privacy-signals-service'

/**
 * The tracker served at `/assets/analytics.js`.
 *
 * It is the same page-view tracker a page inlines (`buildPageViewTracker`), so
 * the two cannot drift apart on what they send, on the Do Not Track and Global
 * Privacy Control signals they honour, or on how they escape the endpoint and
 * the app name. It does NOT carry the on-page outbound-click delegate: that
 * lives in `src/presentation/render/scripts/click-delegate-script.ts`, which
 * this layer may not import, and only the inlined copy (the one that runs)
 * emits it.
 *
 * No cookies, no external dependencies.
 */
export function generateTrackingScript(
  endpoint: string,
  appName: string,
  privacySignals: PrivacySignalSettings,
  consentHold?: TrackerConsentHold
): string {
  return buildPageViewTracker({
    endpoint,
    appName,
    privacySignals,
    ...(consentHold === undefined ? {} : { consentHold }),
  })
}
