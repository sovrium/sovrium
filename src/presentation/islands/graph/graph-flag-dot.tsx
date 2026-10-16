/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one caution mark a flagged `graph` node carries, in either layout.
 *
 * A dot in the design's warning ink, never a second state: `state` is drawn as
 * WEIGHT and never as colour, so the flag takes the colour channel the state
 * leaves free, and a paused node that is also flagged reads as both. The mark
 * is colour plus position only; its word reaches a pointer as the node's
 * `title` and a screen reader through the accessible twin's row.
 */

import type { ReactElement } from 'react'

const FLAG_RADIUS = 4

/** The caution dot, centred on `(x, y)` — drawn only for a node that carries a flag. */
export function GraphFlagDot({
  flag,
  x,
  y,
}: {
  readonly flag: string | undefined
  readonly x: number
  readonly y: number
}): ReactElement | undefined {
  if (flag === undefined) return undefined
  return (
    <circle
      data-slot="graph-node-flag"
      cx={x}
      cy={y}
      r={FLAG_RADIUS}
      className="text-warning"
      fill="currentColor"
    />
  )
}
