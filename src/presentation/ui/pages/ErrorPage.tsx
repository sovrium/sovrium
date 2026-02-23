/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { createErrorPageConfig } from '@/presentation/ui/pages/DefaultPageConfigs'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'

/**
 * ErrorPage component - 500 internal server error page
 *
 * This page is displayed when the server encounters an unexpected error.
 * It provides a clear message and a link back to the homepage.
 *
 * Uses DynamicPage pattern with theme-generated styles for consistency across the application.
 *
 * @returns React element for 500 error page
 */
export function ErrorPage(): Readonly<ReactElement> {
  const pageConfig = createErrorPageConfig()
  return <DynamicPage page={pageConfig} />
}
