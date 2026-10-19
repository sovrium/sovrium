/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToast } from '../runtime/toast'

/** Flip the page between light and dark, and say which it is now, in the page language. */
export function toggleDarkMode(strings: Readonly<Record<string, string>>): void {
  const root = document.documentElement
  const enable = !root.classList.contains('dark')
  root.classList.toggle('dark', enable)
  renderToast(
    enable
      ? (strings['darkModeOn'] ?? 'Dark mode enabled')
      : (strings['lightModeOn'] ?? 'Light mode enabled')
  )
}
