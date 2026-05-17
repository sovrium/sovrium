/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BuiltInAnalytics } from '@/domain/models/app/analytics'

/**
 * Extract session timeout from analytics config, defaulting to 30 minutes.
 */
export function extractSessionTimeout(analytics: BuiltInAnalytics | undefined): number {
  if (analytics === undefined || analytics === false || analytics === true) return 30
  return analytics.sessionTimeout ?? 30
}

/**
 * Check if built-in analytics tracking should be injected for a given page path.
 *
 * Returns true when analytics is configured and enabled, and the page path
 * is not in the excludedPaths list.
 */
export function shouldInjectAnalytics(
  analytics: BuiltInAnalytics | undefined,
  pagePath: string
): boolean {
  if (analytics === undefined || analytics === false) return false
  if (analytics === true) return true
  const { excludedPaths } = analytics
  if (!excludedPaths || excludedPaths.length === 0) return true
  return !excludedPaths.some((pattern: string) => {
    // Support simple glob patterns: * matches any segment, ** matches anything
    const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
    return regex.test(pagePath)
  })
}
