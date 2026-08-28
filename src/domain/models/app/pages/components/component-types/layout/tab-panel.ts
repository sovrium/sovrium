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
 * - `label`       — the text on the tab trigger (visible in the tab list)
 * - `description` — an optional second line rendered beneath the label on the
 *                   trigger, for tab sets that name a feature and then say what
 *                   it does
 * - `body`        — the text shown in the tab panel when this tab is active
 *
 * Defined as a structured object (rather than reusing the parent
 * Component's string-typed `content` field) so the renderer can split
 * trigger text from panel text without parsing conventions like
 * "label\n\n---\n\nbody".
 *
 * `description` is readable from EITHER placement — `content.description` here,
 * or `props.description` (`ComponentPropsSchema` is an open record, so it needs
 * no field of its own) — exactly as `label` already is.
 * Whichever placement an author uses, the trigger's ACCESSIBLE NAME stays the
 * label alone: the description is associated via
 * `aria-describedby`, never appended to the name, so every existing
 * `getByRole('tab', { name })` keeps resolving the moment an author adds a
 * subtitle.
 */
export const TabPanelContentSchema = Schema.Struct({
  label: Schema.String.annotate({ description: 'Text on the tab trigger button' }),
  description: Schema.optional(
    Schema.String.annotate({
      description:
        'Secondary line rendered beneath the label on the tab trigger; associated with the trigger via aria-describedby, and never part of its accessible name',
    })
  ),
  body: Schema.optional(
    Schema.String.annotate({
      description: 'Text content of the tab panel; omit when the panel renders children',
    })
  ),
}).pipe(Schema.annotate({ identifier: 'TabPanelContent', title: 'Tab Panel Content' }))

export const tabPanelFields = {
  ...coreFields,
  ...visibilityFields,
  content: Schema.optional(TabPanelContentSchema),
} as const
