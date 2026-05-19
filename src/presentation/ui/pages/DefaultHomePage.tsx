/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { createDefaultHomePageConfig } from '@/presentation/ui/pages/DefaultPageConfigs'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'
import type { App } from '@/domain/models/app'

export function DefaultHomePage({
  app,
  builtInAnalyticsEnabled,
  builtInAnalyticsSessionTimeout,
}: {
  readonly app: App
  readonly builtInAnalyticsEnabled?: boolean
  readonly builtInAnalyticsSessionTimeout?: number
}): Readonly<ReactElement> {
  const pageConfig = createDefaultHomePageConfig(app)
  return (
    <DynamicPage
      page={pageConfig}
      builtInAnalyticsEnabled={builtInAnalyticsEnabled}
      builtInAnalyticsSessionTimeout={builtInAnalyticsSessionTimeout}
    />
  )
}
