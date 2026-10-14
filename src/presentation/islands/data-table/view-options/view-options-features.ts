/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
} from '@tanstack/react-table'

/**
 * The view-options slice of the grid's feature registry: which columns show,
 * in what order, at what width.
 *
 * `columnPinningFeature` is not here, and CANNOT replace `frozen-columns.ts`.
 * v9 removed v8's `column.getStart()`: the feature computes no offsets at all,
 * and its model is STRUCTURAL (split the header and cells into three regions,
 * render them as separate tables). This grid renders one `<table>` and pins
 * with `position: sticky`, which needs a `left` value v9 will not supply, and
 * which `frozen-columns.ts` MEASURES because an auto-layout grid's real widths
 * are not the declared ones. The frozen-column specs assert that a frozen header
 * and its body cells hold their x within 1px under horizontal scroll, so any replacement has to reproduce
 * offsets v9 does not compute.
 */
export const viewOptionsFeatures = {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
} as const
