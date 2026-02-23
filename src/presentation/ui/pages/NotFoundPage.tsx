/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { createNotFoundPageConfig } from '@/presentation/ui/pages/DefaultPageConfigs'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'

/**
 * NotFoundPage component - 404 error page
 *
 * This page is displayed when a user navigates to a route that doesn't exist.
 * It provides a clear message and a link back to the homepage.
 *
 * Uses DynamicPage pattern with theme-generated styles for consistency across the application.
 *
 * @returns React element for 404 error page
 */
export function NotFoundPage(): Readonly<ReactElement> {
  const pageConfig = createNotFoundPageConfig()
  return <DynamicPage page={pageConfig} />
}
