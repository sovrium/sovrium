/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The glyph that stands for one node kind — KIND BY SHAPE, state by weight.
 *
 * ─── WHY THE SHAPES ARE GENERATED AND NOT ENUMERATED ───────────────────────
 *
 * The obvious implementation is a lookup from `person` to a circle and `table`
 * to a square. It is also the one thing this component's schema forbids: the
 * node vocabulary belongs to the BOUND ENDPOINT, twelve kinds on the one
 * shipped wire and a different set on the next, and a renderer holding that
 * table would be the platform learning one endpoint's words.
 *
 * So a shape is a REGULAR POLYGON derived from an index the projection assigned
 * by first appearance. Two axes give twelve distinguishable glyphs from one
 * six-line generator: the side count runs 3..8, and the second pass rotates by
 * a half-step, which turns a square into a diamond and an up-triangle into a
 * down-triangle. Beyond twelve it cycles, and the legend is what decodes any of
 * it — which is exactly the argument the schema makes for `graph` having a key
 * where `matrix` refused one.
 *
 * ─── AND WHY IT IS MONOCHROME ──────────────────────────────────────────────
 *
 * `apps/BRAND.md` and [internal ref] reserve colour for CONSEQUENCE. A map where
 * twelve kinds each took a hue would spend the whole palette on taxonomy and
 * leave nothing to say "this grant is unbounded" with. Kind is carried by
 * shape, state by weight (dashed, or muted), and colour by neither.
 */

/** Distinct polygons before the vocabulary wraps: 3..8 sides, each unrotated and rotated. */
const SIDE_STEPS = 6

/** The smallest polygon drawn. A triangle reads at this size; a 2-gon does not. */
const MIN_SIDES = 3

/**
 * The points of the polygon standing for `shape`, centred on the origin.
 *
 * `toFixed(2)` rather than raw floats: an SVG `points` attribute built from
 * unrounded trigonometry differs in its last digits between engines, which
 * makes an otherwise-identical drawing compare unequal for no reason a reader
 * could see.
 */
export const polygonPoints = (shape: number, radius: number): string => {
  const sides = MIN_SIDES + (Math.abs(shape) % SIDE_STEPS)
  const rotated = Math.floor(Math.abs(shape) / SIDE_STEPS) % 2 === 1
  const offset = -Math.PI / 2 + (rotated ? Math.PI / sides : 0)
  return Array.from({ length: sides }, (_, corner) => {
    const angle = (corner / sides) * Math.PI * 2 + offset
    return `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`
  }).join(' ')
}

/**
 * How a node's operational state is drawn, as a dash pattern and a tone.
 *
 * The wire spells three states and this reads them as OPEN strings: an
 * unrecognised word falls through to "no weight applied", which is what lets a
 * second endpoint with a different state vocabulary draw here rather than
 * throwing. The mapping itself is the wire's own instruction — "dashed =
 * paused, grey = disabled", and colour reserved for the platform's role tokens.
 */
export const stateWeight = (
  state: string | undefined
): { readonly dash?: string; readonly muted: boolean } => {
  if (state === 'paused') return { dash: '4 3', muted: false }
  if (state === 'disabled') return { muted: true }
  return { muted: false }
}
