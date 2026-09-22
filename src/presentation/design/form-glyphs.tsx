/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The stroke glyphs the forms cluster draws, shared by the SSR skeletons and
 * the hydrated islands (wave R-E).
 *
 * Same reasoning and same home as `nav-menu-parts.tsx`: both surfaces sit on
 * opposite sides of the `presentation-component` ↔ `presentation-island`
 * boundary and cannot import each other, so a glyph both draw lives in
 * `presentation/utils/recipes`. Drawing it once is what stops a dropzone's
 * arrow flashing in — or changing shape — when the island mounts.
 *
 * Every path is authored on the **16-unit grid at stroke 1.5** with round caps
 * and joins, the house geometry R-F normalised the rest of the icon set onto
 * (`chrome.mjs:88`). `width`/`height` set the rendered size; the viewBox never
 * changes, so a 13px cross and an 18px arrow are the same drawing at two
 * scales rather than two drawings.
 *
 * Colour is always `currentColor` — never a token — so a glyph takes the tone
 * of the text it sits in and needs no recipe of its own.
 */

import type { ReactElement } from 'react'

interface GlyphProps {
  /** Rendered size in CSS pixels. The 16-unit viewBox is fixed. */
  readonly size?: number
  /** Extra classes for layout only; the glyph never paints its own colour. */
  readonly className?: string
}

/**
 * The upload arrow at the head of a drop target — an arrow rising out of a
 * baseline. `spec-form.mjs:23`, drawn at 18px.
 *
 * Replaces the literal `⬆` character the SSR skeleton used and the literal `+`
 * the island used: two different glyphs for one affordance, neither of which
 * could be sized or aligned like the rest of the icon set.
 */
export function UploadGlyph({ size = 18, className }: GlyphProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 11V4M5 7l3-3 3 3M3 12.5h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The magnifier on a search field. `chrome.mjs:114` (`ic.searchS`), drawn at
 * 16px inside a control and 13px in dense chrome.
 */
export function SearchGlyph({ size = 16, className }: GlyphProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M11.2 7A4.2 4.2 0 1 1 2.8 7a4.2 4.2 0 0 1 8.4 0Zm-.9 3.3 3.2 3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// A DISMISS cross belongs here too — `chrome.mjs:117` draws one at 13px — but
// nothing in the forms cluster removes anything yet, so it would be a glyph with
// no call site. It goes in beside the control that needs it.

/**
 * The generic file mark on a picked-file row. `spec-form.mjs:24`, drawn at
 * 14px: a page with a folded corner.
 */
export function FileGlyph({ size = 14, className }: GlyphProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 2.5h5l3 3v8H4zM9 2.5v3h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
