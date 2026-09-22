/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The frames every run of text in a graph drawing is held inside.
 *
 * ─── WHY ANYTHING CLIPS AT ALL ─────────────────────────────────────────────
 *
 * Every string in both drawings comes off the wire — a node's `label`, and
 * under it in the lanes gutter its `detail`, which for an automation is the
 * human name its author gave it. None of them has a length the layout can
 * bound, and nothing here had ever constrained one. Measured on the console's
 * own Processes lens at 1440px, the gutter's second line ran to x=219 against a
 * station track that starts at x=200 — nineteen pixels UNDER the first station
 * box, which is painted over it.
 *
 * The layered drawing had the identical hole against its own 176px node boxes
 * and had simply been lucky in the labels it had met, which is why this lives
 * in one module both drawings reach rather than beside the defect that was
 * observed. A wider gutter would only move the cliff; a frame removes it.
 *
 * ─── AND WHY A CLIP RATHER THAN AN ELLIPSIS ────────────────────────────────
 *
 * Truncating to a character budget needs font metrics. The server has none, and
 * these drawings are painted on both sides, so a budget computed from one would
 * drift from the other and the two paints would disagree — against a module
 * whose whole premise is that the geometry is computed and the same read draws
 * identically twice. A clip is pure geometry: one rectangle, no measurement,
 * and the same figure from either side.
 *
 * Nothing is lost to it either. The full string stays reachable twice over —
 * `<title>` carries it to the pointer, and the accessible twin prints it whole,
 * server-rendered outside this island.
 *
 * ─── WHAT A CALLER HAS TO DO ───────────────────────────────────────────────
 *
 * A clip frame is a RECTANGLE IN THE REFERENCING ELEMENT'S OWN USER SPACE, so
 * the box frame is declared once AT THE ORIGIN and every boxed label reaches it
 * by carrying `transform="translate(x, y)"` and relative coordinates. That is
 * what keeps one `<clipPath>` serving 52 nodes instead of 52 serving one each.
 *
 * The gutter frame needs no transform: it is a vertical band at x=0 spanning
 * the whole canvas, so every lane's two lines already sit inside the one
 * rectangle.
 *
 * @see ./graph-clip-ids.ts — where the ids come from, and why they are sanitised
 * @see ./graph-lanes-drawing.tsx — the gutter band and the station boxes
 * @see ./graph-drawing.tsx — the layered node boxes
 */

import { COLUMN_WIDTH, NODE_HEIGHT } from '@/presentation/islands/graph/graph-layout'
import type { GraphClipIds } from '@/presentation/islands/graph/graph-clip-ids'
import type { ReactElement } from 'react'

/**
 * How far inside its border a boxed label stops.
 *
 * The box carries a 1px stroke at its own edge, so a glyph clipped flush with
 * it would read as tucked under the border rather than as cut off. Four pixels,
 * on both sides, because a station label is centred and an asymmetric frame
 * would shift it off centre.
 */
const BOX_INSET = 4

/** The frame a boxed label is held inside — at the ORIGIN, see the note above. */
function BoxClip({ id }: { readonly id: string }): ReactElement {
  return (
    <clipPath
      id={id}
      clipPathUnits="userSpaceOnUse"
    >
      <rect
        x={BOX_INSET}
        y={0}
        width={COLUMN_WIDTH - BOX_INSET * 2}
        height={NODE_HEIGHT}
      />
    </clipPath>
  )
}

/** Every frame a layered drawing needs: one box, shared by every node label. */
export function LayeredTextClips({ ids }: { readonly ids: GraphClipIds }): ReactElement {
  return (
    <defs>
      <BoxClip id={ids.box} />
    </defs>
  )
}

/**
 * Every frame a lanes drawing needs: the gutter band, and the station box.
 *
 * The gutter takes the FULL slot width where a box takes an inset one. It is
 * drawn as text and not as a box, so there is no border for a glyph to touch,
 * and the 24px of connector room after `COLUMN_WIDTH` is what keeps a clipped
 * glyph from reading as a collision with the first station.
 */
export function LanesTextClips({
  ids,
  height,
}: {
  readonly ids: GraphClipIds
  readonly height: number
}): ReactElement {
  return (
    <defs>
      <clipPath
        id={ids.gutter}
        clipPathUnits="userSpaceOnUse"
      >
        <rect
          x={0}
          y={0}
          width={COLUMN_WIDTH}
          height={height}
        />
      </clipPath>
      <BoxClip id={ids.box} />
    </defs>
  )
}
