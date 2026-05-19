/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildProviderElements } from './analytics-builders'
import type { Analytics } from '@/domain/models/app/pages/meta'

export function AnalyticsHead({
  analytics,
}: {
  readonly analytics?: Analytics | { readonly [x: string]: unknown }
}): Readonly<ReactElement | undefined> {
  if (
    !analytics ||
    !('providers' in analytics) ||
    !Array.isArray(analytics.providers) ||
    analytics.providers.length === 0
  ) {
    return undefined
  }

  const analyticsConfig = analytics as Analytics

  return <>{analyticsConfig.providers.flatMap(buildProviderElements)}</>
}
