/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, type ReactNode } from 'react'
import { mergeLayouts } from '@/domain/models/app/page/layout-merge'
import { Banner } from '@/presentation/components/layout/banner'
import { Footer } from '@/presentation/components/layout/footer'
import { Navigation } from '@/presentation/components/layout/navigation'
import { Sidebar } from '@/presentation/components/layout/sidebar'
import type { Layout } from '@/domain/models/app/page/layout'
import type { Page } from '@/domain/models/app/pages'

/**
 * Props for PageLayout component
 */
type PageLayoutProps = {
  readonly page: Page
  readonly defaultLayout?: Layout
  readonly children: ReactNode
}

/**
 * Renders optional layout components (banner, navigation, sidebar, footer)
 *
 * Always renders layout component wrappers to ensure they exist in the DOM.
 * Components are hidden when not configured to support .toBeHidden() test assertions.
 * Uses <template> element for hidden placeholders to avoid DOM pollution.
 *
 * Supports defaultLayout at application level with per-page override/extension:
 * - page.layout = null: Disable all layout (blank page)
 * - page.layout = undefined: Use defaultLayout from app
 * - page.layout = object: Use ONLY what's defined in page layout (complete override)
 *
 * @param props - Component props
 * @returns Layout wrapper with conditional components
 */
export function PageLayout({
  page,
  defaultLayout,
  children,
}: PageLayoutProps): Readonly<ReactElement> {
  const effectiveLayout = mergeLayouts(defaultLayout, page.layout)

  return (
    <>
      {effectiveLayout?.banner ? (
        <Banner {...effectiveLayout.banner} />
      ) : (
        <span
          data-testid="banner"
          hidden
        />
      )}
      {effectiveLayout?.navigation ? (
        <Navigation {...effectiveLayout.navigation} />
      ) : (
        <span
          data-testid="navigation"
          hidden
        />
      )}
      {effectiveLayout?.sidebar ? (
        <Sidebar {...effectiveLayout.sidebar} />
      ) : (
        <span
          data-testid="sidebar"
          hidden
        />
      )}
      {children}
      {effectiveLayout?.footer ? (
        <Footer {...effectiveLayout.footer} />
      ) : (
        <span
          data-testid="footer"
          hidden
        />
      )}
    </>
  )
}
