/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The type treatment of a drawn table's header row — the ONE definition, shared
 * by the SSR recipe and the data-table island.
 *
 * It lives in `presentation/utils/design` (not in `element-renderers/recipes`)
 * for the same reason `input-default-classes.ts` does: `[internal ref]`
 * lets `presentation-component`, `presentation-rendering` AND `presentation-island`
 * each import a `presentation-util`, but an island may NOT import a
 * `presentation-component`. A util-layer home is the one place both render paths
 * can reach with zero boundary friction.
 *
 * Why only the TYPE and not the geometry: cell padding on the island comes from
 * `ROW_HEIGHT_CLASSES`, driven by the author-facing `rowHeight` schema option
 * (`short` / `medium` / `tall`). That is behaviour, not a class restatement, so it
 * stays with the density map and is deliberately absent here. The SSR recipe adds
 * its own `px-2 py-(--sv-density-row-y)` on top of this constant.
 *
 * A header reads as chrome by WEIGHT, by the rule beneath it, and by sitting one
 * step SMALLER than the data — never by an uppercase, letter-spaced treatment:
 * uppercasing a column label costs legibility at this type step and buys
 * emphasis the border already supplies.
 *
 * 11px against the body's 12px, which is the canvas' pairing and a reversal of
 * what shipped. Header and body used to share ONE 11px step, on the argument
 * that the grid already separates them so the header needs no second signal.
 * That argument holds — and was applied to the wrong row. It says the header
 * needs no emphasis; it does not say the DATA should be shrunk to meet it. A
 * table is read for its values, so the values take the larger step and the
 * header keeps the smaller one it always had.
 */
export const TABLE_HEADER_TYPE = 'text-xs font-medium'
