/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { createDefaultHomePageConfig } from '@/presentation/ui/pages/DefaultPageConfigs'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'
import type { App } from '@/domain/models/app'

/**
 * DefaultHomePage component - Default home page displaying application information
 *
 * This is the fallback home page shown when no custom page configuration is provided.
 * Displays the app name, optional version badge, and optional description in a centered layout.
 *
 * Uses DynamicPage pattern with theme-generated styles for consistency across the application.
 *
 * @param props - Component props
 * @param props.app - Validated application data from AppSchema
 * @param props.builtInAnalyticsEnabled - Whether built-in analytics should be enabled
 * @returns React element with app information
 */
export function DefaultHomePage({
  app,
  builtInAnalyticsEnabled,
}: {
  readonly app: App
  readonly builtInAnalyticsEnabled?: boolean
}): Readonly<ReactElement> {
  const pageConfig = createDefaultHomePageConfig(app)
  return (
    <DynamicPage
      page={pageConfig}
      builtInAnalyticsEnabled={builtInAnalyticsEnabled}
    />
  )
}
