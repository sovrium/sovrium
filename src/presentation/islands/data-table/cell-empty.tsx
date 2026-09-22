/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shared "this cell holds nothing" primitives, used by every read-only cell
 * renderer in the grid.
 *
 * Both halves were previously copied into `./cell-renderers.tsx` and
 * `./scalar-cell-renderers.tsx`, and the copies had already drifted: one
 * em-dash fell back to `oklch(0.445 0 0)` and the other to
 * `oklch(0.445 0.012 55)`. Two adjacent empty cells in the same row could
 * therefore render in two different colours, and the chromatic one was a
 * survivor of the `--sv-warmth-*` ramp that
 * [[internal ref] D5](../../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * deleted — a warm tint in chrome, which A7 keeps monochrome. The achromatic
 * value is the one kept.
 *
 * The fallback only paints when `--sv-fg-muted` is absent (it is defined by the
 * default theme layer), so this is a latent divergence rather than a live
 * defect — but it is one definition of one placeholder either way.
 *
 * That definition now lives in the grid's recipe rather than here, so the
 * placeholder's tone moves with every other tone the grid paints.
 */

import { computeTableEmptyValueClasses } from '@/presentation/design/table-default-classes'

/** Shown wherever a cell's value is absent. */
export const EMPTY_VALUE = <span className={computeTableEmptyValueClasses()}>—</span>

/**
 * Whether a cell value names nothing at all.
 *
 * Empty string counts as missing: a cleared text cell reads back as `''` and
 * must render the placeholder rather than a zero-width gap. `0` and `false` do
 * NOT count — they are values, and a `checkbox` or `progress` cell holding one
 * has something to say.
 */
export const isMissing = (value: unknown): boolean =>
  value === undefined || value === null || value === ''
