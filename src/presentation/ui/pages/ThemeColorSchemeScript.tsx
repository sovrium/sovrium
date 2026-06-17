/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildColorSchemeScript, needsColorSchemeScript } from './ThemeColorScheme'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

export function ThemeColorSchemeScript({
  page,
  theme,
}: {
  readonly page: Page
  readonly theme: Theme | undefined
}): ReactElement | undefined {
  if (!needsColorSchemeScript(page, theme)) return undefined
  return (
    <script
      dangerouslySetInnerHTML={{ __html: buildColorSchemeScript(theme?.colorScheme) }}
    />
  )
}
