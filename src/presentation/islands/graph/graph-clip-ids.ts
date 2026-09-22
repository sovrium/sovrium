/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Clip-frame ids unique to ONE graph drawing.
 *
 * Its own module, and not a third export beside the two frame components it
 * feeds, because `react-refresh/only-export-components` is right about the
 * reason: a file mixing components with the hooks they need cannot be reloaded
 * as a unit.
 *
 * @see ./graph-text-clip.tsx — the frames these ids name
 */

import { useId } from 'react'

/** The two frames one drawing declares. A layered drawing uses `box` alone. */
export interface GraphClipIds {
  readonly gutter: string
  readonly box: string
}

/**
 * Ids no second graph on the same page can collide with.
 *
 * `useId` is the house idiom for this and is hydration-stable, but its value
 * carries delimiters — `«r0»` in React 19, `:r0:` before it — that have no
 * business inside a `url(#…)` reference. Stripping to alphanumerics keeps the
 * per-instance counter that makes it unique and drops everything that does not.
 *
 * Without it, two lanes drawings on one page would both resolve to whichever
 * `<clipPath>` the document defined first, and the shorter one's gutter band
 * would clip the taller one's lower lanes away entirely.
 */
export function useGraphClipIds(): GraphClipIds {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  return { gutter: `sv-graph-gutter-${uid}`, box: `sv-graph-box-${uid}` }
}
