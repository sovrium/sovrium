/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { createErrorPageConfig } from '@/presentation/ui/pages/DefaultPageConfigs'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'

export function ErrorPage(): Readonly<ReactElement> {
  const pageConfig = createErrorPageConfig()
  return <DynamicPage page={pageConfig} />
}
