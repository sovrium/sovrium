/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BuiltInAnalytics } from './analytics'

/** The session window, in minutes, when `analytics.sessionTimeout` is omitted. */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 30

/**
 * The effective session window in minutes: `analytics.sessionTimeout`, or 30
 * when it is omitted or analytics is the boolean shorthand.
 *
 * Page views, outbound clicks, short-link clicks, QR scans and the inlined
 * tracker all read it here, so no road can count a session in another window.
 */
export function resolveSessionTimeout(analytics: BuiltInAnalytics | undefined): number {
  return typeof analytics === 'object'
    ? (analytics.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT_MINUTES)
    : DEFAULT_SESSION_TIMEOUT_MINUTES
}
