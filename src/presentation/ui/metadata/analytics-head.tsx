/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildProviderElements } from './analytics-builders'
import type { Analytics } from '@/domain/models/app/page/meta/analytics'

/**
 * Render analytics provider scripts and configuration in HEAD section
 * Generates DNS prefetch, external scripts with data-testid, and initialization scripts
 *
 * @param analytics - Analytics configuration from page.meta (union type)
 * @returns React fragment with head elements
 */
export function AnalyticsHead({
  analytics,
}: {
  readonly analytics?: Analytics | { readonly [x: string]: unknown }
}): Readonly<ReactElement | undefined> {
  // Type guard: ensure analytics has providers array (not generic record)
  if (
    !analytics ||
    !('providers' in analytics) ||
    !Array.isArray(analytics.providers) ||
    analytics.providers.length === 0
  ) {
    return undefined
  }

  // Type assertion: after type guard, we know analytics has providers array
  const analyticsConfig = analytics as Analytics

  // Render all providers using builder pattern
  return <>{analyticsConfig.providers.flatMap(buildProviderElements)}</>
}
