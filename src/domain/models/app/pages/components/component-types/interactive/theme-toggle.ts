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

export const themeToggleFields = {
  ...coreFields,
  ...visibilityFields,
  label: Schema.optional(
    Schema.String.annotations({
      description: "Accessible label for the toggle button (default: 'Toggle theme')",
    })
  ),

  variant: Schema.optional(
    Schema.Literal('text', 'icon').annotations({
      description:
        "Toggle visual: 'text' shows the label (default), 'icon' shows a sun/moon glyph pair",
    })
  ),
} as const
