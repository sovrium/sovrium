/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildColorSchemeScript, needsColorSchemeScript } from './ThemeColorScheme'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Inline no-FOUC color-scheme head script.
 *
 * Returns `undefined` (renders nothing) when neither a `theme-toggle` (page
 * direct OR hosted in a referenced `app.components` template) nor
 * `theme.colorScheme` is in play, so unrelated pages keep their existing
 * head-script count.
 */
export function ThemeColorSchemeScript({
  page,
  components,
  theme,
}: {
  readonly page: Page
  readonly components?: Components
  readonly theme: Theme | undefined
}): ReactElement | undefined {
  if (!needsColorSchemeScript(page, theme, components)) return undefined
  return (
    <script
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only no-FOUC head script; never re-renders client-side
      dangerouslySetInnerHTML={{ __html: buildColorSchemeScript(theme?.colorScheme) }}
    />
  )
}
