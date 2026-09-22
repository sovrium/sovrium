/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { isOperatorConsoleApp } from '@/domain/models/app/admin/admin-data-nav'
import { isBadgeEnabled } from '@/domain/models/app/badge'
import { createDefaultHomePageConfig } from '@/presentation/render/page/default-page-configs'
import { DynamicPage } from '@/presentation/render/page/dynamic-page'
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
  builtInAnalyticsSessionTimeout,
}: {
  readonly app: App
  readonly builtInAnalyticsEnabled?: boolean
  readonly builtInAnalyticsSessionTimeout?: number
}): Readonly<ReactElement> {
  const pageConfig = createDefaultHomePageConfig(app)
  // `demoNoticeEnabled` mirrors the operator-console carve-out that
  // `renderPageHtml` applies. This fallback is reachable for a console surface
  // when a `/` page matched but then bailed (unresolvable collection / unknown
  // content-dir slug), so without it the demo notice would render on `/_admin`.
  return (
    <DynamicPage
      page={pageConfig}
      builtInAnalyticsEnabled={builtInAnalyticsEnabled}
      builtInAnalyticsSessionTimeout={builtInAnalyticsSessionTimeout}
      badgeEnabled={isBadgeEnabled(app.badge)}
      demoNoticeEnabled={!isOperatorConsoleApp(app)}
    />
  )
}
