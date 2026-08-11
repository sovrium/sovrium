/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ToastActionSchema } from '../../action'
import { actionFields } from '../modules/action'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ReorderableListTypeLiteral = Schema.Literal('reorderable-list')

export const reorderableListFields = {
  ...coreFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  reorderable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable drag-and-drop reordering of list items',
    })
  ),
  /**
   * Action fired once a reorder settles.
   *
   * Narrowed to `toast`, the ONLY variant the renderer implements: it emits
   * `data-on-reorder-toast-{message,variant}` attributes for a
   * `{ type: 'toast' }` action and nothing at all for anything else
   * (`reorderableListComponent` in
   * `src/presentation/ui/sections/rendering/component-registry/reorderable-list-component.tsx`).
   * The full `ActionSchema` used to be accepted here, so the other seven
   * variants validated and then silently emitted no attributes.
   *
   * Known residual gap (NOT fixed by this narrowing): `ToastAction.duration`
   * is still dropped — no `data-on-reorder-toast-duration` is emitted and the
   * toast never auto-dismisses.
   */
  onReorder: Schema.optional(ToastActionSchema),
} as const
