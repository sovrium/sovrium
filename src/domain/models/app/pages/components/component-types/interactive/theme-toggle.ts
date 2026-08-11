/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const ThemeToggleTypeLiteral = Schema.Literal('theme-toggle')

/**
 * Runtime light/dark theme toggle button.
 *
 * Renders an accessible `<button>` that flips the `dark` class on `<html>`
 * and persists the visitor's choice in `localStorage.theme`. Pairs with the
 * no-FOUC head script (emitted when a `theme-toggle` is present or
 * `theme.colorScheme` is configured) which applies the stored / system /
 * configured scheme before content renders.
 */
export const themeToggleFields = {
  ...coreFields,
  ...visibilityFields,
  /**
   * Accessible button label. Defaults to `'Toggle theme'`. Must match the
   * toggle's intent (theme / dark / light) so it is discoverable by role +
   * accessible name.
   */
  label: Schema.optional(
    Schema.String.annotations({
      description: "Accessible label for the toggle button (default: 'Toggle theme')",
    })
  ),

  /**
   * Visual variant of the toggle button.
   *
   *   - `'text'` (default): the resolved `label` is shown as the button text.
   *   - `'icon'`: a sun / moon glyph pair is shown instead (sun visible in dark
   *     mode, moon in light mode) and the `label` becomes the accessible name
   *     only (`aria-label`), so the button stays discoverable by role + name
   *     while reading as a compact icon button in chrome (navbars, toolbars).
   */
  variant: Schema.optional(
    Schema.Literal('text', 'icon').annotations({
      description:
        "Toggle visual: 'text' shows the label (default), 'icon' shows a sun/moon glyph pair",
    })
  ),
} as const
