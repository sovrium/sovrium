/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Circle, Heart, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

/**
 * One mark of a rating scale, drawn as shadcn's rating examples draw it: a
 * lucide icon, outlined, and filled with the current colour once earned.
 *
 * ONE glyph for every surface that draws a rating — the server-drawn reading
 * and input, the hosted form, the data table's cell and the form island — so
 * a declared `style` reads the same everywhere: `stars` draws `Star`, `hearts`
 * `Heart`, `circles` `Circle`, and an unknown style falls back to stars. The
 * icon is sized in `em`, so the rating's own type step (`size`) sizes it.
 *
 * `filled` paints the earned state here. A surface that repaints without
 * script (the server-drawn input, whose earned state is its checked radio)
 * leaves it unset and fills the icon from CSS instead (`[&_svg]:fill-current`).
 *
 * Three static named imports: each tree-shakes to its own geometry, never the
 * icon set (see `lucide-glyph.tsx` for what the namespace import costs).
 */

const RATING_ICONS: Readonly<Record<string, LucideIcon>> = {
  stars: Star,
  hearts: Heart,
  circles: Circle,
}

const GLYPH_CLASS = 'size-[1em] shrink-0'

export function RatingGlyph({
  style,
  filled = false,
}: {
  readonly style?: string
  readonly filled?: boolean
}): ReactElement {
  const Icon = RATING_ICONS[style ?? 'stars'] ?? Star
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      className={filled ? `${GLYPH_CLASS} fill-current` : GLYPH_CLASS}
    />
  )
}
