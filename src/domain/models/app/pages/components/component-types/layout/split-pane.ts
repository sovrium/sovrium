/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `split-pane` layout component-type
 *.
 *
 * A resizable two-pane layout primitive: two child panes separated by a
 * draggable divider, with `orientation` (side-by-side vs stacked), a
 * `defaultRatio` initial split, and per-pane min/max sizing. It is broadly
 * reusable (master-detail / edit-while-you-see), but its first consumer is the
 * dogfooded admin Config tab (editor left │ live preview right).
 *
 * The resize is an island concern; the SSR fallback is a static side-by-side
 * layout (both panes present in the server-rendered markup before hydration).
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const SplitPaneTypeLiteral = Schema.Literal('split-pane')

/**
 * Split direction. `horizontal` = side-by-side (the Config default);
 * `vertical` = stacked. Defaults to `horizontal`.
 */
export const SplitPaneOrientationSchema = Schema.Literals(['horizontal', 'vertical']).annotate({
  title: 'Split-pane Orientation',
  description:
    'Split direction: horizontal (side-by-side) or vertical (stacked). Default: horizontal.',
})

export const splitPaneFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  orientation: Schema.optional(SplitPaneOrientationSchema),
  /**
   * Initial split ratio for the FIRST pane (0–1). Defaults to `0.5` (an even
   * split). The divider drag adjusts it within the panes' min/max constraints.
   */
  defaultRatio: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0), Schema.isLessThan(1))).annotate({
      description: 'Initial fraction of the container the first pane occupies (0–1). Default: 0.5.',
    })
  ),
  /** Minimum size (px) the first pane may shrink to during a drag. */
  minSize: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))).annotate({
      description: 'Minimum size (px) of the first pane while resizing.',
    })
  ),
  /** Maximum size (px) the first pane may grow to during a drag. */
  maxSize: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))).annotate({
      description: 'Maximum size (px) of the first pane while resizing.',
    })
  ),
} as const
