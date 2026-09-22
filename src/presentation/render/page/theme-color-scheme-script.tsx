/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildColorSchemeScript, needsColorSchemeScript } from './theme-color-scheme'
import type { Components } from '@/domain/models/app/components'
import type { Design } from '@/domain/models/app/design'
import type { Page } from '@/domain/models/app/pages'

/**
 * Inline no-FOUC color-scheme head script.
 *
 * Returns `undefined` (renders nothing) when neither a `theme-toggle` (page
 * direct OR hosted in a referenced `app.components` template) nor
 * `design.colorScheme` is in play, so unrelated pages keep their existing
 * head-script count.
 */
export function ThemeColorSchemeScript({
  page,
  components,
  design,
}: {
  readonly page: Page
  readonly components?: Components
  readonly design: Design | undefined
}): ReactElement | undefined {
  if (!needsColorSchemeScript(page, design, components)) return undefined
  return (
    <script
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only no-FOUC head script; never re-renders client-side
      dangerouslySetInnerHTML={{ __html: buildColorSchemeScript(design?.colorScheme) }}
    />
  )
}
