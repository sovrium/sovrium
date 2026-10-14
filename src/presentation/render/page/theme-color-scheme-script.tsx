/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildColorSchemeScript } from './theme-color-scheme'
import type { Design } from '@/domain/models/app/design'

/**
 * Inline no-FOUC color-scheme head script, on every page.
 *
 * Every app follows the visitor's colour scheme unless it says otherwise:
 * `design.colorScheme` defaults to `system`, and the engine's default design
 * carries a dark palette, so the script has to run on every page to put the
 * `dark` class on `<html>` before first paint. An app that wants to stay light
 * declares `colorScheme: light`; the script still runs, so a stored visitor
 * preference set through a `theme-toggle` keeps winning.
 */
export function ThemeColorSchemeScript({
  design,
}: {
  readonly design: Design | undefined
}): ReactElement {
  return (
    // eslint-disable-next-line sovrium/require-sanitized-html -- engine script; its only config value is narrowed to dark, light or system
    <script dangerouslySetInnerHTML={{ __html: buildColorSchemeScript(design?.colorScheme) }} />
  )
}
