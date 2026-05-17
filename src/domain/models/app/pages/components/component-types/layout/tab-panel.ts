/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const TabPanelTypeLiteral = Schema.Literal('tab-panel')

/**
 * Tab-panel content: the user-facing strings rendered for each tab.
 *
 * - `label` — the text on the tab trigger (visible in the tab list)
 * - `body`  — the text shown in the tab panel when this tab is active
 *
 * Defined as a structured object (rather than reusing the parent
 * Component's string-typed `content` field) so the renderer can split
 * trigger text from panel text without parsing conventions like
 * "label\n\n---\n\nbody".
 */
export const TabPanelContentSchema = Schema.Struct({
  label: Schema.String.annotations({ description: 'Text on the tab trigger button' }),
  body: Schema.optional(
    Schema.String.annotations({
      description: 'Text content of the tab panel; omit when the panel renders children',
    })
  ),
}).pipe(Schema.annotations({ identifier: 'TabPanelContent', title: 'Tab Panel Content' }))

export const tabPanelFields = {
  ...coreFields,
  ...visibilityFields,
  content: Schema.optional(TabPanelContentSchema),
} as const
